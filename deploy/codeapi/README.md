# Self-hosted Code Interpreter (ClickHouse `code-interpreter`)

Since v0.8.7 LibreChat no longer uses the legacy hosted Code Interpreter API
with `LIBRECHAT_CODE_API_KEY` (that env var and its `X-API-Key` path were
removed from core). The `execute_code` capability now talks to a code-execution
backend at `LIBRECHAT_CODE_BASEURL`, authenticating with a short-lived **JWT**.

This directory wires LibreChat to a **self-hosted** ClickHouse
[`code-interpreter`](https://github.com/ClickHouse/code-interpreter) stack.

## How it connects

```
LibreChat-API  ──POST http://codeapi:3112/v1/exec  (Authorization: Bearer <JWT>)──▶  code-interpreter "api"
   signs the JWT with the EdDSA PRIVATE key                            validates with the EdDSA PUBLIC key
                                                                       (issuer/audience/kid must match)
```

- **Bridge**: a shared external Docker network `codeapi-net`. The interpreter's
  `api` joins it with the network alias **`codeapi`**, and LibreChat's `api`
  joins it too, so LibreChat reaches the gateway at `http://codeapi:3112/v1`.
  (`host.docker.internal` does not work here: the two compose stacks sit on
  different bridge networks, so a shared network is the reliable path.)
- **Sandbox**: KVM / libkrun microVM (upstream default, the hardened mode).
  Requires `/dev/kvm` on the host.
- **Auth**: EdDSA JWT. LibreChat mints (private key); the interpreter validates
  (public key).

## One-time setup

### 1. Generate the JWT key pair

```bash
./deploy/codeapi/gen-jwt-keys.sh
```

This writes `deploy/codeapi/keys/` (gitignored) and prints two ready-to-paste
blocks: one for the LibreChat `.env`, one for the interpreter `.env`.

### 2. Configure LibreChat

Paste block (1) into the LibreChat `.env` (next to `deploy-compose.yml`) and
**remove the old** `LIBRECHAT_CODE_API_KEY` line. `deploy-compose.yml` already
passes `LIBRECHAT_CODE_BASEURL`, `CODEAPI_AUTH_PROVIDER` and the JWT settings
into the `api` service.

### 3. Deploy the interpreter stack

```bash
git clone https://github.com/ClickHouse/code-interpreter.git
cd code-interpreter
git checkout 9d3936fa73e1b447f2e9a3a3961cdef8b411da18   # pinned; upstream has no tags yet

# Production env: copy the template and fill in the secrets.
cp /path/to/LibreChat/deploy/codeapi/codeapi.env.example .env
#  - paste block (2) from gen-jwt-keys.sh (CODEAPI_JWT_PUBLIC_KEY)
#  - CODEAPI_INTERNAL_SERVICE_TOKEN / CODEAPI_EGRESS_GRANT_SECRET / CODEAPI_BRIDGE_TOKEN:
#    openssl rand -hex 32 each
#  - CODEAPI_EXECUTION_MANIFEST_PRIVATE_KEY / SANDBOX_EXECUTION_MANIFEST_PUBLIC_KEY:
#    see the comment in codeapi.env.example

# Compose override: shared network alias, restart policies, clock-drift autoheal.
cp /path/to/LibreChat/deploy/codeapi/docker-compose.override.yml .

docker compose build   # long: the KVM runner image bakes Python/Node/Bun runtimes
docker compose up -d
```

The KVM runner target (`sandbox-runner-true`) bakes the language runtimes into the
image; `./build-packages.sh` / `./data/pkgs` are only needed for the non-KVM
(`KVM_ENABLED=false`) path.

> Pinned upstream commit: `9d3936fa73e1b447f2e9a3a3961cdef8b411da18` (2026-09-12).
> Previous pin `3fa1f6cd6897e60be32b09dae132ae656ccff11d` had no clock-drift
> detection (see below).

### 4. (Re)start LibreChat

```bash
docker compose -f deploy-compose.yml up -d
```

Enable the `execute_code` agent capability in `librechat.yaml` /
admin panel if it isn't already.

## Verify

```bash
# Interpreter is up:
curl -fsS http://localhost:3112/v1/health

# In LibreChat, an agent with execute_code runs e.g. `print(2+2)` and returns 4.
```

If exec calls fail with 401/403, the JWT did not validate — check that
`issuer`, `audience` and `kid` are identical on both sides and that the public
key matches the private key.

## Guest clock drift (why executions used to die with "not valid yet")

The sandbox API validates each signed execution manifest **inside the libkrun
microVM**, rejecting it when `iat > now + 30s` (hard-coded tolerance). The guest
has no time sync, so its clock drifts behind the host by roughly 1-2 s/day; after
~3 weeks every `/exec` fails with
`502 {"error":"sandbox_execution_failed","message":"Execution manifest is not valid yet"}`
while `/v1/health` still reports OK.

Upstream does not fix the drift, it detects it: `sandbox-runner-healthcheck.sh`
compares the guest's HTTP `Date` header with the host clock and marks the
container unhealthy past `SANDBOX_RUNNER_CLOCK_SKEW_LIVENESS_LIMIT_SECONDS`
(10). Docker never restarts an unhealthy container on its own, hence the
`autoheal` sidecar in `docker-compose.override.yml` (restarts containers labelled
`autoheal=true`). Expected cadence: one ~30 s restart of the runner every ~6-7
days; executions keep working during the ~5 min it takes the check to flip
(10 s of skew is well under the 30 s tolerance).

Measure the skew (the healthcheck script prints nothing on success):

```bash
G=$(curl -sS -D - -o /dev/null http://localhost:2000/api/v2/health | grep -i '^date:' | cut -d' ' -f2-)
echo "skew: $(( $(date -u +%s) - $(date -u -d "$G" +%s) )) s"
```

Verify the recovery path without waiting a week (a throwaway container with a
failing healthcheck must be restarted by autoheal within seconds; use
`.State.StartedAt`, `docker events --filter event=restart` or the autoheal logs,
never `RestartCount`, which `docker restart` resets):

```bash
docker run -d --name autoheal-probe --label autoheal=true \
  --health-cmd 'exit 1' --health-interval 2s --health-retries 1 alpine sleep 600
sleep 15; docker inspect -f '{{.State.StartedAt}}' autoheal-probe; docker logs codeapi-autoheal | tail -2
docker rm -f autoheal-probe
```

Manual relief if it ever happens again: `docker compose restart sandbox-runner`.

## Storage retention (resource growth)

Most resources are self-cleaning: sandbox workspaces are reaped on an interval
(`SANDBOX_WORKSPACE_REAPER_MAX_AGE_SECONDS`, default 1h), Redis exec/tool state
and tool-call sessions have TTLs, and per-job sandboxes are ephemeral.

The exception is **MinIO object storage**: generated files are only removed on
explicit delete (when a user deletes the file/message in LibreChat). There is no
built-in expiry, so orphaned files can accumulate. A bucket lifecycle rule
expires objects after 30 days as a safety net:

```bash
docker run --rm --network code-interpreter_default --entrypoint sh minio/mc -c '
  mc alias set ci http://minio:9000 minioadmin minioadmin
  mc ilm rule add --expire-days 30 ci/test-bucket
  mc ilm rule ls ci/test-bucket'
```

This rule lives in the bucket metadata (the `minio_data` volume) and survives
restarts; re-apply it only if that volume is recreated. Note: it expires *every*
object older than 30 days, including files still referenced by old conversations
(the message keeps its reference but the file becomes unavailable).

## Security notes

- Bind the interpreter's published port to localhost only
  (`127.0.0.1:3112:3112`) so it is not exposed beyond the host.
- This service runs arbitrary untrusted code. Keep `CODEAPI_HARDENED_SANDBOX_MODE=true`
  and KVM mode on; run it on isolated infrastructure. See the upstream
  README "Security disclaimer".
- Never commit `deploy/codeapi/keys/` or either `.env`.
