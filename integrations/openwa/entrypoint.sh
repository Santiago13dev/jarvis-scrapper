#!/bin/sh
set -e

# Clean any corrupted session data from previous runs
SESSION_DIR="${SESSION_DATA_PATH:-./session}"
rm -rf "${SESSION_DIR}/.data.json" 2>/dev/null || true
mkdir -p /data

# Start OpenWA server
exec npx @open-wa/wa-automate start \
  -p 8080 \
  --session-id main \
  --qr-timeout 0 \
  --no-kill-on-logout \
  --skip-update-check \
  --use-chrome \
  --cors \
  --no-kill-on-ban \
  --headless \
  "$@"
