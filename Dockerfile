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

# Liveness: não depende do Postgres. Se dependesse, um blip do banco
# reiniciaria o container sem necessidade.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# migrations primeiro (idempotente), depois a API.
# `exec` garante que o Bun seja PID 1 e receba o SIGTERM do rolling update.
CMD ["sh", "-c", "bun src/infra/database/scripts/migrate.ts && exec bun src/main.ts"]
