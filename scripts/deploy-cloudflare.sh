#!/usr/bin/env bash
# Idempotent production deploy to Cloudflare Workers.
#
#   CLOUDFLARE_API_TOKEN=... [HYPERDRIVE_ORIGIN_URL=postgres://user:pass@host:5432/postgres] \
#     bash scripts/deploy-cloudflare.sh
#
# Token permissions: Account › Workers Scripts:Edit, Account › Hyperdrive:Edit,
# Account › Account Settings:Read, User › User Details:Read, User › Memberships:Read
# (the "Edit Cloudflare Workers" template + Hyperdrive:Edit).
#
# Steps (each skipped when already done):
#   1. resolve the account   2. register the workers.dev subdomain
#   3. create the Hyperdrive config (caching off) from HYPERDRIVE_ORIGIN_URL
#   4. write its id into wrangler.jsonc   5. generate JWT_SECRET once
#   6. build with OpenNext and deploy      7. wait for the public URL
#
# Optional: WORKERS_SUBDOMAIN (default bu4cdimex; only used when the account has no
# workers.dev subdomain yet), HYPERDRIVE_NAME (default crm-db).
set -euo pipefail
cd "$(dirname "$0")/.."

: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN (see header)}"
SUBDOMAIN="${WORKERS_SUBDOMAIN:-bu4cdimex}"
HD_NAME="${HYPERDRIVE_NAME:-crm-db}"
API="https://api.cloudflare.com/client/v4"
WORKER="$(node -e 'console.log(require("fs").readFileSync("wrangler.jsonc","utf8").match(/"name":\s*"([^"]+)"/)[1])')"

cf() { curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" "$@"; }
# Evaluate a JS expression against JSON on stdin (variable `j`); prints "" when null/undefined.
json() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let j;try{j=JSON.parse(s)}catch{j={}};const v=(()=>{try{return $1}catch{return undefined}})();console.log(v==null?'':typeof v==='string'?v:JSON.stringify(v))})"; }
cf_errors() { json "(j.errors||[]).map(e=>e.code+': '+e.message).join('; ')"; }

echo "▶ 1/7 Account"
if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  accounts="$(cf "$API/accounts")"
  CLOUDFLARE_ACCOUNT_ID="$(printf '%s' "$accounts" | json "j.result && j.result.length===1 ? j.result[0].id : ''")"
  if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
    echo "  Could not pick an account ($(printf '%s' "$accounts" | cf_errors)). Set CLOUDFLARE_ACCOUNT_ID." >&2
    exit 1
  fi
fi
export CLOUDFLARE_ACCOUNT_ID
echo "  $CLOUDFLARE_ACCOUNT_ID"

echo "▶ 2/7 workers.dev subdomain"
SUB="$(cf "$API/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/subdomain" | json "j.result && j.result.subdomain")"
if [ -z "$SUB" ]; then
  res="$(cf -X PUT "$API/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/subdomain" -d "{\"subdomain\":\"$SUBDOMAIN\"}")"
  if [ "$(printf '%s' "$res" | json "j.success")" != "true" ]; then
    echo "  Failed to set subdomain: $(printf '%s' "$res" | cf_errors)" >&2
    exit 1
  fi
  SUB="$SUBDOMAIN"
elif [ "$SUB" != "$SUBDOMAIN" ]; then
  # The API refuses to replace an existing subdomain (10036); the dashboard can.
  echo "  Account already uses '$SUB'. To use '$SUBDOMAIN': Workers & Pages → Change next to Your subdomain."
fi
echo "  $SUB.workers.dev"

echo "▶ 3/7 Hyperdrive '$HD_NAME'"
HD_ID="$(cf "$API/accounts/$CLOUDFLARE_ACCOUNT_ID/hyperdrive/configs" | json "((j.result||[]).find(c=>c.name==='$HD_NAME')||{}).id")"
if [ -z "$HD_ID" ]; then
  : "${HYPERDRIVE_ORIGIN_URL:?No Hyperdrive config yet — set HYPERDRIVE_ORIGIN_URL to the database connection string}"
  # Body goes through stdin, never argv, so the password is not visible in `ps`.
  res="$(HD_NAME="$HD_NAME" node -e '
    const u = new URL(process.env.HYPERDRIVE_ORIGIN_URL);
    process.stdout.write(JSON.stringify({
      name: process.env.HD_NAME,
      origin: {
        scheme: "postgres",
        host: u.hostname,
        port: Number(u.port || 5432),
        database: decodeURIComponent(u.pathname.slice(1)) || "postgres",
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
      },
      caching: { disabled: true },
    }));' | cf -X POST "$API/accounts/$CLOUDFLARE_ACCOUNT_ID/hyperdrive/configs" --data-binary @-)"
  HD_ID="$(printf '%s' "$res" | json "j.result && j.result.id")"
  if [ -z "$HD_ID" ]; then
    echo "  Hyperdrive creation failed: $(printf '%s' "$res" | cf_errors)" >&2
    exit 1
  fi
fi
echo "  $HD_ID"

echo "▶ 4/7 wrangler.jsonc"
HD_ID="$HD_ID" node -e '
  const fs = require("fs");
  const text = fs.readFileSync("wrangler.jsonc", "utf8");
  const re = /("hyperdrive":\s*\[\s*\{[^\]]*?"id":\s*")[^"]*(")/;
  if (!re.test(text)) { console.error("  hyperdrive binding not found in wrangler.jsonc"); process.exit(1); }
  fs.writeFileSync("wrangler.jsonc", text.replace(re, `$1${process.env.HD_ID}$2`));'
echo "  HYPERDRIVE binding → $HD_ID"

echo "▶ 5/7 Secrets"
SECRETS_FILE=""
# Must succeed when there is nothing to delete: an EXIT trap's status becomes the script's.
cleanup() { [ -z "$SECRETS_FILE" ] || rm -f "$SECRETS_FILE"; }
trap cleanup EXIT
if npx wrangler secret list --format json 2>/dev/null | grep -q '"JWT_SECRET"'; then
  echo "  JWT_SECRET already set (kept — rotating it would sign everyone out)"
else
  SECRETS_FILE="$(mktemp)"
  chmod 600 "$SECRETS_FILE"
  node -e 'process.stdout.write(JSON.stringify({ JWT_SECRET: require("crypto").randomBytes(48).toString("base64url") }))' > "$SECRETS_FILE"
  echo "  JWT_SECRET generated (uploaded with this deploy, never printed)"
fi

echo "▶ 6/7 Build & deploy"
npx opennextjs-cloudflare build
if [ -n "$SECRETS_FILE" ]; then
  npx wrangler deploy --secrets-file "$SECRETS_FILE"
else
  npx wrangler deploy
fi

URL="https://$WORKER.$SUB.workers.dev"
echo "▶ 7/7 Waiting for $URL"
code=000
for _ in $(seq 1 36); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$URL/login" || true)"
  [ "$code" = "200" ] && break
  sleep 10
done
echo "  /login → HTTP $code"
echo
echo "✔ Deployed: $URL"
