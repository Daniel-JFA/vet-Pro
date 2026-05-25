#!/usr/bin/env bash
set -euo pipefail

# deploy.sh - despliega la pila vetpro en el host
# Ubicación esperada (desde repo): scripts/deploy.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STACK_DIR="$ROOT_DIR/stacks/vetpro"

cd "$STACK_DIR"

echo "Pulling images..."
docker-compose pull --ignore-pull-failures

echo "Starting containers..."
docker-compose up -d --remove-orphans

# Healthcheck loop
for i in {1..20}; do
  if curl -s -H "Host: vetpro.danielflorez.dev" http://127.0.0.1:8090/api/health | grep -q '"status":"ok"'; then
    echo "Service healthy"
    exit 0
  fi
  sleep 3
done

echo "Healthcheck failed" >&2
exit 2
