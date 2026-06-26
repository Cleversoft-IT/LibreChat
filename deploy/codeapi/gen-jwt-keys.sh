#!/usr/bin/env bash
#
# Generate an EdDSA (Ed25519) key pair for LibreChat <-> ClickHouse
# code-interpreter JWT authentication and print ready-to-paste .env blocks
# for both sides.
#
#   - Private key  -> LibreChat            (CODEAPI_JWT_PRIVATE_KEY_BASE64)
#   - Public  key  -> code-interpreter api (CODEAPI_JWT_PUBLIC_KEY)
#
# The two sides authenticate when issuer / audience / kid match. Defaults
# below mirror the values wired into deploy-compose.yml.
#
# Usage:
#   ./deploy/codeapi/gen-jwt-keys.sh [output_dir]
#
set -euo pipefail

KID="${CODEAPI_JWT_KID:-lc-codeapi-1}"
ISSUER="${CODEAPI_JWT_ISSUER:-librechat}"
AUDIENCE="${CODEAPI_JWT_AUDIENCE:-codeapi}"
OUT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/keys}"

command -v openssl >/dev/null 2>&1 || { echo "openssl is required" >&2; exit 1; }

mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"
PRIV_PEM="$OUT_DIR/codeapi_jwt_private.pem"
PUB_PEM="$OUT_DIR/codeapi_jwt_public.pem"

if [ -f "$PRIV_PEM" ]; then
  echo "Refusing to overwrite existing key: $PRIV_PEM" >&2
  echo "Delete it first if you really want to rotate keys." >&2
  exit 1
fi

openssl genpkey -algorithm ed25519 -out "$PRIV_PEM" >/dev/null 2>&1
openssl pkey -in "$PRIV_PEM" -pubout -out "$PUB_PEM" >/dev/null 2>&1
chmod 600 "$PRIV_PEM" "$PUB_PEM"

# Base64 (single line) of the PKCS8 PEM for LibreChat.
PRIV_B64="$(base64 -w0 "$PRIV_PEM" 2>/dev/null || base64 "$PRIV_PEM" | tr -d '\n')"
# SPKI PEM with newlines escaped to \n so it fits on a single .env line.
PUB_ESCAPED="$(awk 'BEGIN{ORS="\\n"}{print}' "$PUB_PEM")"

cat <<EOF

Keys written to: $OUT_DIR
  private: $PRIV_PEM  (keep secret, never commit)
  public:  $PUB_PEM

============================================================================
 1) LibreChat  -> add to the LibreChat .env (next to deploy-compose.yml)
============================================================================
CODEAPI_AUTH_PROVIDER=librechat-jwt
CODEAPI_JWT_ALGORITHM=EdDSA
CODEAPI_JWT_ISSUER=$ISSUER
CODEAPI_JWT_AUDIENCE=$AUDIENCE
CODEAPI_JWT_KID=$KID
CODEAPI_JWT_PRIVATE_KEY_BASE64=$PRIV_B64

============================================================================
 2) code-interpreter -> add to the ClickHouse stack .env
    (see deploy/codeapi/codeapi.env.example)
============================================================================
CODEAPI_AUTH_PROVIDER=librechat-jwt
CODEAPI_JWT_ALLOWED_ALGS=EdDSA
CODEAPI_JWT_ISSUER=$ISSUER
CODEAPI_JWT_AUDIENCE=$AUDIENCE
CODEAPI_JWT_KID=$KID
CODEAPI_JWT_PUBLIC_KEY=$PUB_ESCAPED

EOF
