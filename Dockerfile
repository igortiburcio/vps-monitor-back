# --- deps ---------------------------------------------------------------
FROM oven/bun:1.4 AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# --- runtime ------------------------------------------------------------
FROM oven/bun:1.4 AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY drizzle ./drizzle

USER bun
EXPOSE 3000

# migrations primeiro (idempotente), depois a API
CMD ["sh", "-c", "bun src/db/migrate.ts && bun src/main.ts"]
