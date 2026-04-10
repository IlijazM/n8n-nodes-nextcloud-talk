#!/bin/bash
# Configure Nextcloud for integration tests:
#   - Install the Talk (spreed) app
#   - Install a deterministic test bot (id=1) for Bot-resource tests
# User creation is handled by globalSetup.ts via the provisioning REST API.
# Usage: bash tests/integration/scripts/configure-nextcloud.sh

set -e

COMPOSE_FILE="tests/integration/docker-compose.yml"
OCC="docker compose -f $COMPOSE_FILE exec -T nextcloud php occ"

echo "==> Installing Talk (spreed) app..."
$OCC app:install spreed 2>&1 || $OCC app:enable spreed 2>&1 || echo "  Talk may already be installed — continuing."

echo "==> Installing test bot (id=1 on fresh container)..."
# The URL is intentionally a no-op — Bot-resource tests exercise enable/disable/list
# and never trigger the webhook callback.
$OCC talk:bot:install \
  --feature webhook --feature response \
  "n8n-test-bot" \
  "integration_test_bot_secret_at_least_40_chars_long" \
  "http://localhost:5678/webhook/nextcloud-talk-test" \
  2>&1 || echo "  Bot install reported an error — continuing (may already be installed)."

echo "==> Nextcloud configuration complete."
