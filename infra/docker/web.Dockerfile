# CaseArena Web — build & run (Next standalone)
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
COPY apps/web/package.json apps/web/
RUN npm install --no-audit --no-fund --workspace web --include-workspace-root

COPY tsconfig.base.json ./
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=1
ARG API_URL=http://api:4000
ENV API_URL=$API_URL
# build-time rewrite target; runtime value comes from env (standalone reads it at boot)
RUN cd apps/web && npm run build

# --- runtime ---
FROM node:20-alpine
WORKDIR /app/apps/web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app/apps/web/.next/standalone /app
COPY --from=build /app/apps/web/.next/static /app/apps/web/.next/static
COPY --from=build /app/apps/web/public /app/apps/web/public

CMD ["node", "apps/web/server.js"]
