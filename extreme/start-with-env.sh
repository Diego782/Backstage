#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
  echo "Loaded .env file"
else
  echo "WARNING: .env file not found in $(pwd)"
  echo "Create one based on .env.example or set environment variables manually"
  exit 1
fi

# Start Backstage with yarn 4
node .yarn/releases/yarn-4.4.1.cjs start
