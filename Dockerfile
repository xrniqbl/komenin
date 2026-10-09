# syntax=docker/dockerfile:1.7

##
## Komenin — production image (Next.js standalone + Prisma)
## Build context = repo root.
##

# ---------- Base ----------
FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
# openssl dibutuhkan Prisma engine
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ---------- Dependencies ----------
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Install reproduksibel dari lockfile (npm 11 di image mendukung lock v3).
RUN npm ci

# ---------- Builder ----------
FROM base AS builder
# Build-arg dari docker-compose (NEXT_PUBLIC_* di-inline ke client bundle).
ARG NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION
ARG TIKTOK_SITE_VERIFICATION
ENV NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=$NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION
ENV TIKTOK_SITE_VERIFICATION=$TIKTOK_SITE_VERIFICATION
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma client
RUN npx prisma generate
# Dummy env agar `next build` tidak gagal saat validasi (nilai asli di-inject saat runtime)
ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-time-placeholder-secret-000000"
ENV AUTH_GOOGLE_ID="build"
ENV AUTH_GOOGLE_SECRET="build"
ENV ENCRYPTION_KEY="0000000000000000000000000000000000000000000000000000000000000000"
RUN npm run build

# ---------- Runner ----------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# User non-root
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Output standalone Next.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma: schema, migrasi, CLI + engine untuk `migrate deploy` saat start.
# Salin SELURUH node_modules (bukan hanya prisma/@prisma): prisma 6.x
# me-resolve transitive deps yang di-hoist ke top-level (effect/fast-check
# via @prisma/config). COPY parsial membuat `migrate deploy` crash-loop
# dengan "Cannot find module 'fast-check'" karena entrypoint `set -e`
# exit 1 dan kontainer restart selamanya.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Preflight tanpa dependensi — bisa dijalankan di VPS via
# `docker compose exec app node ./scripts/preflight-deploy.mjs`
COPY --from=builder --chown=nextjs:nodejs /app/scripts/preflight-deploy.mjs ./scripts/preflight-deploy.mjs

# Entrypoint
COPY --chown=nextjs:nodejs deploy/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
