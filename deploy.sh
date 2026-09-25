#!/usr/bin/env bash
# Deploy scam-checker lên https://faodigital.vn/scam/
# FE static + (tuỳ chọn) đồng bộ nginx. BE deploy riêng bằng fao_be/deploy.sh.
set -euo pipefail

SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
SERVER="root@103.200.21.54"
REMOTE_DIR="/var/www/html/scam"
REMOTE_STAGE="/var/www/html/scam.next"
BUILD_DIR="${BUILD_DIR:-dist}"

cd "$(dirname "$0")"

echo "Building scam-checker (mode=product, base=/scam/)..."
rm -rf "$BUILD_DIR"
npm run build -- --mode product --outDir "$BUILD_DIR" --base /scam/

if [ ! -f "$BUILD_DIR/index.html" ]; then
  echo "ERROR: $BUILD_DIR/index.html not found — build failed?"
  exit 1
fi

echo "Upload to staging ($REMOTE_STAGE)..."
ssh -i "$SSH_KEY" "$SERVER" "rm -rf '$REMOTE_STAGE' && mkdir -p '$REMOTE_STAGE'"
scp -i "$SSH_KEY" -r "$BUILD_DIR"/* "$SERVER:$REMOTE_STAGE/"

echo "Promote staging → live..."
ssh -i "$SSH_KEY" "$SERVER" bash -s <<EOF
set -e
mkdir -p "$(dirname "$REMOTE_DIR")"
rm -rf "$REMOTE_DIR.old"
if [ -d "$REMOTE_DIR" ]; then mv "$REMOTE_DIR" "$REMOTE_DIR.old"; fi
mv "$REMOTE_STAGE" "$REMOTE_DIR"
rm -rf "$REMOTE_DIR.old"
EOF

echo "Verify..."
curl -sI "https://faodigital.vn/scam/" | head -5 || true
curl -sI "https://faodigital.vn/scam/index.html" | head -3 || true

echo "Done → https://faodigital.vn/scam/"
