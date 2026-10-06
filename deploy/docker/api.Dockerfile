# syntax=docker/dockerfile:1
# API CoverView, construite depuis la racine du dépôt : docker build -f deploy/docker/api.Dockerfile .
ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS build
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --ignore-scripts --filter "api..."
RUN cd apps/api && node build.mjs

# Dépendances de production seules ; les paquets du workspace sont intégrés au bundle.
FROM ${NODE_IMAGE} AS dependencies
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin/package.json apps/admin/
COPY apps/api/package.json apps/api/
COPY apps/client/package.json apps/client/
COPY apps/partners/package.json apps/partners/
COPY apps/www/package.json apps/www/
COPY packages/api-client/package.json packages/api-client/
COPY packages/contracts/package.json packages/contracts/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --filter api

FROM ${NODE_IMAGE}
ENV NODE_ENV=production
WORKDIR /app/apps/api
# loadEnvironment() situe la racine du workspace par ce fichier.
COPY --from=build /repo/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --from=dependencies /repo/node_modules /app/node_modules
COPY --from=dependencies /repo/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/apps/api/drizzle ./drizzle
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 4100
CMD ["node", "dist/main.js"]
