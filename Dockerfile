FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm config set strict-dep-builds false
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
ARG BUILD_TARGET=dashboard
ARG PUBLIC_ENABLE_DASHBOARD=true
ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_ANON_KEY
ARG PUBLIC_GITHUB_FEED_TOKEN
ENV BUILD_TARGET=$BUILD_TARGET
ENV PUBLIC_ENABLE_DASHBOARD=$PUBLIC_ENABLE_DASHBOARD
ENV PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL
ENV PUBLIC_SUPABASE_ANON_KEY=$PUBLIC_SUPABASE_ANON_KEY
ENV PUBLIC_GITHUB_FEED_TOKEN=$PUBLIC_GITHUB_FEED_TOKEN
RUN pnpm build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates curl playerctl procps wl-clipboard \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
RUN pnpm config set strict-dep-builds false
RUN pnpm install --prod --frozen-lockfile

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
ENV PUBLIC_ENABLE_DASHBOARD=true
ENV PUBLIC_SUPABASE_URL=""
ENV PUBLIC_SUPABASE_ANON_KEY=""
ENV PUBLIC_GITHUB_FEED_TOKEN=""
EXPOSE 4321 4325
CMD ["node", "dist/server/entry.mjs"]
