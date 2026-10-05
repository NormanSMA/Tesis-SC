# syntax=docker/dockerfile:1
# glibc (bookworm) en lugar de alpine: @node-rs/argon2 y Prisma traen binarios para glibc.

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    CI=true
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# prisma.config.ts exige DATABASE_URL_MIGRACION al cargarse, aunque generate no abre la base.
FROM base AS build
ENV DATABASE_URL_MIGRACION=postgresql://sin:uso@127.0.0.1:5432/sin_uso
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public && pnpm build

FROM base AS tools
ENV DATABASE_URL_MIGRACION=postgresql://sin:uso@127.0.0.1:5432/sin_uso
# openssl: el motor de esquema de Prisma lo busca al migrar.
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm exec prisma generate
ENTRYPOINT ["sh", "/app/scripts/docker/entrypoint.sh", "propietario"]
CMD ["sh", "/app/scripts/db/preparar.sh"]

FROM node:24-bookworm-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --chown=node:node scripts/docker/entrypoint.sh ./scripts/docker/entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/v1/salud').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["sh", "/app/scripts/docker/entrypoint.sh", "app"]
CMD ["node", "server.js"]
