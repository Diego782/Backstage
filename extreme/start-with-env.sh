#!/bin/bash

# Load environment variables from .env file
set -a
source .env
set +a

# Start Backstage with yarn 4
node .yarn/releases/yarn-4.4.1.cjs start
