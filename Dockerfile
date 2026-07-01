# Production image for the Hearth web app (Next.js standalone output).
# LiveKit, coturn, and Postgres run as their own pinned containers (see deploy/).

# --- deps: install with a clean, reproducible lockfile ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: bundle background-effects assets locally, then build ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Populate public/mediapipe/ so blur/backgrounds load from our own origin (no CDN at
# runtime). This is the only build-time third-party fetch.
RUN npm run setup:effects
RUN npm run build

# --- runner: minimal standalone server ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Standalone output + static assets + public/ (includes the effects assets).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
