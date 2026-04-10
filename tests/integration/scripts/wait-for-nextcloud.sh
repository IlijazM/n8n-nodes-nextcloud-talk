#!/bin/bash
# Poll Nextcloud's status endpoint until it reports as installed and ready.
# Usage: bash tests/integration/scripts/wait-for-nextcloud.sh

set -e

URL="${NEXTCLOUD_URL:-http://localhost:8080}/status.php"
MAX_TRIES=90
SLEEP_INTERVAL=3

echo "Waiting for Nextcloud at $URL ..."

for i in $(seq 1 $MAX_TRIES); do
  STATUS=$(curl -s --connect-timeout 2 "$URL" 2>/dev/null || true)
  if echo "$STATUS" | grep -q '"installed":true'; then
    echo "Nextcloud is ready (attempt $i/$MAX_TRIES)"
    exit 0
  fi
  echo "  Not ready yet (attempt $i/$MAX_TRIES) ..."
  sleep $SLEEP_INTERVAL
done

echo "ERROR: Timed out waiting for Nextcloud after $((MAX_TRIES * SLEEP_INTERVAL)) seconds"
exit 1
