FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --only=production && npm cache clean --force

FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
ENV NODE_ENV=production
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Drizzle migrations
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/node_modules ./node_modules

# One-time/admin scripts — run via, e.g.:
#   docker exec <container> npx tsx --tsconfig tsconfig.json scripts/grant-first-admin.ts <email>
# (deliberately NOT overwriting package.json here — Next's standalone build
# writes its own minimal one alongside server.js, and touching it risks
# breaking the running server)
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/lib ./src/lib

RUN apk add --no-cache ffmpeg
RUN mkdir -p /data/audio-cache /data/cover-cache && chown nextjs:nodejs /data/audio-cache /data/cover-cache

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npx drizzle-kit push --force && node server.js"]