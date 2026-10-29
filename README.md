# VPS Monitor — API

API de monitoramento da VPS (Coolify) com chat em linguagem natural sobre as métricas.

- **Runtime:** Bun 1.4
- **Framework:** NestJS 12 + Fastify
- **Auth:** BetterAuth (e-mail/senha, bearer token, signup fechado)
- **ORM:** Drizzle + Postgres 18
- **LLM:** Groq (`openai/gpt-oss-20b`) via LangChain/LangGraph

## Requisitos

- Bun 1.4+
- Postgres acessível (dev: `postgres-pulse-dev` na VPS)

## Setup

```bash
bun install
cp .env.example .env      # preencha as variáveis
bun run db:setup          # cria role, database e aplica migrations (idempotente)
bun run seed:user         # cria o usuário único do app
bun run dev               # http://localhost:4100
```

`db:setup` precisa de `DATABASE_ADMIN_URL` (superuser). Essa variável **não** deve
existir no container da API.

## Scripts

| Script                      | O que faz                                 |
| --------------------------- | ----------------------------------------- |
| `bun run dev`               | hot reload em `src/main.ts`               |
| `bun run start`             | sobe a API                                |
| `bun run db:generate`       | gera migration a partir do schema Drizzle |
| `bun run db:setup`          | cria role + database + aplica migrations  |
| `bun run seed:user`         | cria o usuário do app                     |
| `bun run db:studio`         | Drizzle Studio                            |
| `bun run typecheck`         | `tsc --noEmit`                            |
| `bun run lint` / `lint:fix` | ESLint                                    |
| `bun run format`            | Prettier                                  |
| `bun test`                  | testes                                    |

## Endpoints

| Método | Rota             | Auth       |
| ------ | ---------------- | ---------- |
| GET    | `/health`        | pública    |
| GET    | `/api/docs`      | pública    |
| GET    | `/api/docs-json` | pública    |
| ALL    | `/api/auth/*`    | BetterAuth |
| GET    | `/api/v1/me`     | bearer     |

## Autenticação

O app mobile usa **bearer token** (plugin `bearer` do BetterAuth):

```bash
curl -X POST http://localhost:4100/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"...","password":"..."}'
# a resposta traz `token` e o header `set-auth-token`
```

## Estrutura

```
src/
├── main.ts            FastifyAdapter + Swagger
├── app.module.ts
├── config/env.ts      validação do ambiente (zod)
├── auth/              better-auth + MeController
├── common/            health check
└── db/                schema, client, setup, migrate, seed
drizzle/               migrations versionadas
```

## Deploy

Container no Coolify, domínio `https://monitor.duduisonfire.com` (Cloudflare → Traefik).
O container roda `migrate` antes de subir a API e conecta no Postgres pelo hostname
interno do Docker, não pelo IP público.
