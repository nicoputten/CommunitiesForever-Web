# syntax=docker/dockerfile:1
# The site's image (WEB-07, docs/ARCHITECTURE.md "Hosting"): Next.js standalone output on Node.js 24 LTS.
# Built and pushed to GHCR by .github/workflows/release.yml; run on TrueNAS with deploy/compose.yaml.

# ---- build: all dependencies, then `next build` ----
FROM node:24-slim AS build
# npm runs better-sqlite3's approved install script (`allowScripts` in package.json): `node-gyp rebuild`, which uses
# the shipped prebuilt binding for linux-x64 and compiles from source where there is none. node-gyp needs these.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build \
  && mkdir -p public \
  # better-sqlite3 is copied whole into the image (below); its SQLite sources and headers aren't needed to run.
  && rm -rf node_modules/better-sqlite3/deps node_modules/better-sqlite3/src

# ---- runtime: only the standalone server, no dev dependencies ----
FROM node:24-slim
ARG APP_VERSION=dev
LABEL org.opencontainers.image.source="https://github.com/nicoputten/CommunitiesForever-Web" \
  org.opencontainers.image.description="CommunitiesForever: the WoW: Forever community site" \
  org.opencontainers.image.version="${APP_VERSION}"
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  # Docker sets HOSTNAME to the container id; the standalone server binds to it, so listen on every interface.
  HOSTNAME=0.0.0.0 \
  PORT=3000 \
  DATA_DIR=/data \
  APP_VERSION=${APP_VERSION}
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Applied when the server starts (src/instrumentation.ts → openDatabase); found at <cwd>/drizzle.
COPY --from=build /app/drizzle ./drizzle
# The native binding: better-sqlite3 picks its prebuild at run time, which output tracing may leave out.
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
# The image's user is `node` (UID/GID 1000); deploy/compose.yaml runs it as the dataset's owner instead.
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.js"]
