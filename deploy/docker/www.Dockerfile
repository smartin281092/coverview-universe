# syntax=docker/dockerfile:1
# Site public CoverView (Astro statique servi par Caddy), depuis la racine du dépôt :
# docker build -f deploy/docker/www.Dockerfile --build-arg PUBLIC_API_URL=https://api.coverview.ch .
ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS build
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --ignore-scripts --filter "www..."
# Valeurs publiques intégrées au build ; aucune n'est un secret.
ARG PUBLIC_API_URL
ARG PUBLIC_REQUESTS_ENABLED=false
# Adresse de Wallet pour les liens de compte, à fournir quand les comptes sont ouverts.
ARG PUBLIC_WALLET_URL
ENV PUBLIC_API_URL=${PUBLIC_API_URL} PUBLIC_REQUESTS_ENABLED=${PUBLIC_REQUESTS_ENABLED}
RUN if [ -n "${PUBLIC_WALLET_URL}" ]; then echo "PUBLIC_WALLET_URL=${PUBLIC_WALLET_URL}" > apps/www/.env.production; fi
RUN test -n "${PUBLIC_API_URL}" && cd apps/www && node node_modules/astro/bin/astro.mjs build

FROM caddy:2-alpine
COPY --from=build /repo/apps/www/dist /srv
COPY deploy/production/www.Caddyfile /etc/caddy/Caddyfile
EXPOSE 8080
