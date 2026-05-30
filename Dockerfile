FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS builder
COPY . .
ARG BUILD_TARGET=dashboard
ARG PUBLIC_ENABLE_DASHBOARD=true
ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_ANON_KEY
ARG PUBLIC_GITHUB_FEED_TOKEN
ARG PUBLIC_GITHUB_TOKEN
ENV BUILD_TARGET=$BUILD_TARGET
ENV PUBLIC_ENABLE_DASHBOARD=$PUBLIC_ENABLE_DASHBOARD
ENV PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL
ENV PUBLIC_SUPABASE_ANON_KEY=$PUBLIC_SUPABASE_ANON_KEY
ENV PUBLIC_GITHUB_FEED_TOKEN=$PUBLIC_GITHUB_FEED_TOKEN
ENV PUBLIC_GITHUB_TOKEN=$PUBLIC_GITHUB_TOKEN
RUN bun run build

FROM oven/bun:1-slim AS runner
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates curl playerctl procps wl-clipboard systemd \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
ENV PUBLIC_ENABLE_DASHBOARD=true
ENV PUBLIC_SUPABASE_URL=""
ENV PUBLIC_SUPABASE_ANON_KEY=""
ENV PUBLIC_GITHUB_FEED_TOKEN=""
ENV PUBLIC_GITHUB_TOKEN=""
EXPOSE 4321 4325
CMD ["bun", "run", "dist/server/entry.mjs"]
