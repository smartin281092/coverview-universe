# syntax=docker/dockerfile:1
# Wallet, Partner et Admin (builds Vite statiques servis par Caddy), depuis la racine du dépôt :
# docker build -f deploy/docker/apps.Dockerfile --build-arg VITE_API_URL=https://api.coverview.ch .
ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS build
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --ignore-scripts --filter "client..." --filter "admin..." --filter "partners..."
# Adresses publiques intégrées au build ; aucune n'est un secret.
ARG VITE_API_URL
ARG VITE_WEBSITE_URL=https://coverview.ch
ARG VITE_WALLET_URL=https://wallet.coverview.ch
ARG VITE_ADMIN_URL=https://admin.coverview.ch
ARG VITE_PARTNER_URL=https://partner.coverview.ch
ENV VITE_API_URL=${VITE_API_URL} VITE_WEBSITE_URL=${VITE_WEBSITE_URL} \
    VITE_WALLET_URL=${VITE_WALLET_URL} VITE_ADMIN_URL=${VITE_ADMIN_URL} \
    VITE_PARTNER_URL=${VITE_PARTNER_URL}
RUN test -n "${VITE_API_URL}" && for app in client admin partners; do \
      (cd apps/$app && node node_modules/vite/bin/vite.js build) || exit 1; \
    done

FROM caddy:2-alpine
COPY --from=build /repo/apps/client/dist /srv/wallet
COPY --from=build /repo/apps/admin/dist /srv/admin
COPY --from=build /repo/apps/partners/dist /srv/partner
COPY deploy/production/apps.Caddyfile /etc/caddy/Caddyfile
EXPOSE 8080
