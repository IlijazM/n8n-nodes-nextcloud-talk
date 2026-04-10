#!/bin/bash
# Configure Nextcloud for integration tests:
#   - Install the Talk (spreed) app
# User creation is handled by globalSetup.ts via the provisioning REST API.
# Usage: bash tests/integration/scripts/configure-nextcloud.sh

set -e

COMPOSE_FILE="tests/integration/docker-compose.yml"
OCC="docker compose -f $COMPOSE_FILE exec -T nextcloud php occ"

echo "==> Installing Talk (spreed) app..."
$OCC app:install spreed 2>&1 || $OCC app:enable spreed 2>&1 || echo "  Talk may already be installed — continuing."

echo "==> Nextcloud configuration complete."
