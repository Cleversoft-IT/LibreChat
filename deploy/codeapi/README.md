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

# Pre-build the language runtimes (Python/Node/Bun) into ./data/pkgs.
# This is mounted read-only into the sandbox; the stack will not run without it.
./build-packages.sh

# Production env: copy the template and fill in the secrets.
cp /path/to/LibreChat/deploy/codeapi/codeapi.env.example .env
#  - paste block (2) from gen-jwt-keys.sh (CODEAPI_JWT_PUBLIC_KEY)
#  - CODEAPI_INTERNAL_SERVICE_TOKEN=$(openssl rand -hex 32)
#  - CODEAPI_EGRESS_GRANT_SECRET=$(openssl rand -hex 32)

docker compose up --build -d
```

> Pinned/known-good upstream commit at integration time:
> `3fa1f6cd6897e60be32b09dae132ae656ccff11d`.

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
