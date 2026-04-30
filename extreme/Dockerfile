# Multi-stage Dockerfile for Backstage
# Builds frontend and backend inside the container — no pre-build needed.

# ---- Stage 1: Build ----
FROM node:22-bookworm-slim AS build

ENV PYTHON=/usr/bin/python3

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 g++ build-essential libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

USER node
WORKDIR /app

# Copy dependency files first for better layer caching
COPY --chown=node:node .yarn ./.yarn
COPY --chown=node:node .yarnrc.yml package.json yarn.lock backstage.json ./
COPY --chown=node:node packages/backend/package.json ./packages/backend/package.json
COPY --chown=node:node packages/app/package.json ./packages/app/package.json

# Install all dependencies (including devDependencies for build)
RUN yarn install --immutable

# Copy source code
COPY --chown=node:node . .

# Build the backend (includes the bundled frontend)
RUN yarn tsc
RUN yarn build:backend

# ---- Stage 2: Production ----
FROM node:22-bookworm-slim

ENV PYTHON=/usr/bin/python3

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 g++ build-essential libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

USER node
WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--no-node-snapshot"

# Copy dependency files
COPY --chown=node:node --from=build /app/.yarn ./.yarn
COPY --chown=node:node --from=build /app/.yarnrc.yml ./
COPY --chown=node:node --from=build /app/backstage.json ./

# Copy the built skeleton and install production deps only
COPY --chown=node:node --from=build /app/yarn.lock /app/package.json ./
COPY --chown=node:node --from=build /app/packages/backend/dist/skeleton.tar.gz ./
RUN tar xzf skeleton.tar.gz && rm skeleton.tar.gz

RUN yarn workspaces focus --all --production && rm -rf "$(yarn cache clean)"

# Copy examples and config
COPY --chown=node:node --from=build /app/examples ./examples
COPY --chown=node:node --from=build /app/app-config*.yaml ./

# Copy the built backend bundle
COPY --chown=node:node --from=build /app/packages/backend/dist/bundle.tar.gz ./
RUN tar xzf bundle.tar.gz && rm bundle.tar.gz

EXPOSE 7007

CMD ["node", "packages/backend", "--config", "app-config.yaml", "--config", "app-config.production.yaml"]
