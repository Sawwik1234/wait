# CaseArena API — build & run
FROM node:20-alpine AS build
WORKDIR /app

# install workspace deps (api subset)
COPY package.json ./
COPY apps/api/package.json apps/api/
RUN npm install --no-audit --no-fund --workspace api --include-workspace-root

# build
COPY tsconfig.base.json ./
COPY apps/api apps/api
RUN cd apps/api && npx prisma generate --schema prisma/schema.prisma && npm run build

# --- runtime ---
FROM node:20-alpine
WORKDIR /app/apps/api
ENV NODE_ENV=production

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api /app/apps/api
COPY --from=build /app/package.json /app/package.json

# migrate (works for SQLite and PostgreSQL URLs) then start
CMD ["sh", "-c", "npx prisma db push --accept-data-loss --skip-generate && if node -e \"process.exit(String(process.env.DATABASE_URL).startsWith('postgres')?0:1)\"; then npx prisma generate --schema prisma/schema.prisma; fi && node dist/main.js"]
