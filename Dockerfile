FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json ./
COPY packages/api/package.json packages/api/package.json
COPY packages/web/package.json packages/web/package.json

RUN pnpm install --frozen-lockfile=false

COPY . .

RUN pnpm --filter @spot-hist/web build
RUN pnpm --filter @spot-hist/api build
RUN pnpm deploy --filter @spot-hist/api --prod /prod/api

FROM node:22-alpine
RUN apk add --no-cache tini wget
WORKDIR /app

COPY --from=builder /prod/api .
COPY --from=builder /app/packages/web/dist ./public

ENV NODE_ENV=production
ENV CONFIG_DIR=/config

EXPOSE 3000
VOLUME ["/config"]

HEALTHCHECK CMD wget -qO- http://localhost:3000/api/setup/status || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
