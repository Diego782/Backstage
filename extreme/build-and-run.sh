#!/bin/bash
set -e

YARN="node .yarn/releases/yarn-4.4.1.cjs"

echo "=== Step 1: Install dependencies ==="
$YARN install --immutable

echo ""
echo "=== Step 2: Type check ==="
$YARN tsc

echo ""
echo "=== Step 3: Build backend ==="
$YARN build:backend

echo ""
echo "=== Step 4: Build Docker image ==="
DOCKER_BUILDKIT=1 docker build . -f packages/backend/Dockerfile --tag backstage

echo ""
echo "=== Step 5: Start services ==="
docker compose up -d

echo ""
echo "=== Done! ==="
echo "Backstage is starting at http://localhost:7007"
echo "Run 'docker compose logs -f backstage' to see logs"
