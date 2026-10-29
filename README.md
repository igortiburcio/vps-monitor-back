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

| Método | Rota                                        | Auth                       |
| ------ | ------------------------------------------- | -------------------------- |
| GET    | `/health/live`                              | pública                    |
| GET    | `/health/ready`                             | pública                    |
| GET    | `/health`                                   | pública (alias de `ready`) |
| GET    | `/api/docs` · `/api/docs-json`              | pública                    |
| ALL    | `/api/auth/*`                               | BetterAuth                 |
| GET    | `/api/v1/me`                                | bearer                     |
| GET    | `/api/v1/overview`                          | bearer                     |
| GET    | `/api/v1/host/current` · `/history`         | bearer                     |
| GET    | `/api/v1/containers` · `/:id` · `/:id/logs` | bearer                     |
| GET    | `/api/v1/coolify/*`                         | bearer                     |
| GET    | `/api/v1/events/stream`                     | bearer (SSE)               |
| POST   | `/api/v1/ai/chat`                           | bearer (SSE)               |
| GET    | `/api/v1/ai/conversations` · `/:id`         | bearer                     |
| GET    | `/api/v1/diagnostics`                       | bearer                     |

### Liveness x readiness

- `/health/live` — só o processo. É o que o **HEALTHCHECK do Docker** usa: se dependesse
  do Postgres, um blip do banco reiniciaria o container sem necessidade.
- `/health/ready` — processo + dependências. É o que o **Coolify/Traefik** usa para
  decidir se o container recebe tráfego.

## Autenticação

O app mobile usa **bearer token** (plugin `bearer` do BetterAuth):

```bash
curl -X POST http://localhost:4100/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"...","password":"..."}'
# a resposta traz `token` e o header `set-auth-token`
```

## Arquitetura

Quatro camadas, com dependência apontando sempre para dentro:

```
http/          -> controllers, pipes, filtros (entrada)
application/   -> casos de uso (regras da aplicação)
domain/        -> entidades, erros e ports (zero framework)
infra/         -> adapters: Postgres, Docker, Coolify, LangGraph, BetterAuth
```

`domain/` não importa `@nestjs`, `drizzle-orm`, `fastify` nem `better-auth`.
`application/` só conhece os **ports**; `infra/` é quem implementa.
A regra é verificada por teste (`test/architecture.test.ts`), não por convenção.

Inversão de dependência via `abstract class` como token (sem `@Inject`/`Symbol`):

```ts
// domain/ports/host-metrics.port.ts
export abstract class HostMetricsPort {
  abstract sample(): Promise<HostMetrics>;
}

// infra/infra.module.ts (composition root)
{ provide: HostMetricsPort, useClass: ProcHostMetricsAdapter }
```

## Estrutura

```
src/
├── domain/          entities · ports · errors · sanitization
├── application/     use-cases · mappers · dto
├── infra/           config · database · host · docker · coolify · ai · auth · cache · health · scheduling
├── http/            controllers · pipes · filters · dto · scripts
├── app.module.ts    composition root
└── main.ts
test/
├── domain/          regras puras
├── application/     casos de uso com fakes (sem banco, sem rede)
├── infra/           parsers de /proc e env
├── fakes/           implementações em memória dos ports
└── architecture.test.ts
drizzle/             migrations versionadas
```

## Deploy

Container no Coolify, domínio `https://monitor.duduisonfire.com` (Cloudflare → Traefik).
O container roda `migrate` antes de subir a API e conecta no Postgres pelo hostname
interno do Docker, não pelo IP público.
