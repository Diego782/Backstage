# Multi-stage Dockerfile for Backstage

# ---- Stage 1: Build ----
FROM node:22-bookworm-slim AS build

ENV PYTHON=/usr/bin/python3

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 g++ build-essential libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

# Create app dir owned by node BEFORE switching user
RUN mkdir -p /app && chown node:node /app

USER node
WORKDIR /app

# Copy everything needed for install + build
COPY --chown=node:node . .

# Install dependencies and build
RUN yarn install --no-immutable
RUN yarn tsc
RUN yarn build:backend

# ---- Stage 2: Production ----
FROM node:22-bookworm-slim

ENV PYTHON=/usr/bin/python3

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 g++ build-essential libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app && chown node:node /app

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
