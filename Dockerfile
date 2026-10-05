# syntax=docker/dockerfile:1.7
FROM node:22.16.0-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run contracts:check && npm run i18n:check && npm run security:check && npm run routes:check && npm run build

FROM node:22.16.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# The pinned Node image ships an old Alpine; take the security fixes (OpenSSL etc.) at build time.
RUN apk upgrade --no-cache     && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-*        /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg     && addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
# The runtime only executes `node server.js`; the package managers bundled in the base image are unused and
# carry their own vulnerable dependencies (tar, glob, brace-expansion, ...), so they are not shipped.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
