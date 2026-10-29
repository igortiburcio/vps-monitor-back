# Deploy no Coolify

Alvo: `https://monitor.duduisonfire.com` (Cloudflare → Traefik).

A aplicação é um **Docker Compose** (`docker-compose.yaml`), não um app "Dockerfile".
O motivo está no fim deste documento.

## 1. Repositório

```bash
cd vps-monitor-back
gh repo create vps-monitor-back --public --source=. --remote=origin --push
```

O Coolify usa a fonte **Public GitHub** (não há GitHub App configurado na instância).

## 2. Criar a aplicação

- Tipo: **Docker Compose**
- Compose file: `/docker-compose.yaml`
- Base directory: `/`

## 3. Variáveis de ambiente

| Variável                 | Valor                                                                      |
| ------------------------ | -------------------------------------------------------------------------- |
| `NODE_ENV`               | `production`                                                               |
| `PORT`                   | `3000`                                                                     |
| `APP_URL`                | `https://monitor.duduisonfire.com`                                         |
| `BETTER_AUTH_URL`        | `https://monitor.duduisonfire.com`                                         |
| `BETTER_AUTH_SECRET`     | `openssl rand -base64 32`                                                  |
| `DATABASE_URL`           | `postgres://vps_monitor:<senha>@b2wlwdr0njjgsy24kukzd0yf:5432/vps_monitor` |
| `HOST_PROC`              | `/host/proc`                                                               |
| `HOST_SYS`               | `/host/sys`                                                                |
| `HOST_ROOT`              | `/host/root`                                                               |
| `DOCKER_PROXY_URL`       | `http://docker-socket-proxy:2375`                                          |
| `COOLIFY_API_URL`        | `https://coolify.duduisonfire.com`                                         |
| `COOLIFY_API_TOKEN`      | token **somente leitura**                                                  |
| `LLM_PROVIDER`           | `groq`                                                                     |
| `GROQ_API_KEY`           | chave da Groq                                                              |
| `LLM_MODEL`              | `openai/gpt-oss-20b`                                                       |
| `METRICS_INTERVAL_MS`    | `15000`                                                                    |
| `METRICS_RETENTION_DAYS` | `30`                                                                       |
| `SERVICE_FQDN_API`       | `monitor.duduisonfire.com`                                                 |

> `DATABASE_ADMIN_URL` **não** existe no container. O banco é criado pelo
> `bun run db:setup` local; no container as migrations rodam com `DATABASE_URL`
> (a role `vps_monitor` é dona do banco).

O Coolify grava essas variáveis num `.env` e passa `--env-file` para o compose,
então a interpolação `${VAR}` do `docker-compose.yaml` funciona.

## 4. Domínio

Para apps compose, o domínio é por **serviço**, não no campo `fqdn` do app:

```json
{ "api": { "domain": "https://monitor.duduisonfire.com" } }
```

Isso é o que o Coolify guarda em `docker_compose_domains` e usa para gerar as
labels do Traefik.

## 5. Healthcheck

- Path: `/health`
- Porta: `3000`
- Esperado: `200` com `{"status":"ok"}`

## 6. Validação

```bash
curl -s https://monitor.duduisonfire.com/health
curl -s -X POST https://monitor.duduisonfire.com/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"...","password":"..."}'
```

## Por que compose e não o app "Dockerfile"

Duas armadilhas encontradas na prática:

1. **`custom_docker_run_options` ignora `--volume`.** O Coolify converte essas
   opções para o compose gerado usando `DOCKER_RUN_OPTION_MAPPING`
   (`bootstrap/helpers/constants.php`), que **não** inclui `--volume`. O mount é
   descartado silenciosamente e o container passa a ler o próprio `/proc`.
2. **A API de storages só aceita volume nomeado.** `type: bind` é rejeitado,
   então não há como montar `/proc` do host por lá.

Como o app compose aceita `volumes:` explícitos, esse caminho é o único confiável
para ler as métricas reais da máquina.

## Outras armadilhas já resolvidas

| Problema                         | Causa                                              | Correção                                        |
| -------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| `EAI_AGAIN` no Postgres          | app compose nasce numa network própria             | `networks: [default, coolify]` no serviço `api` |
| `no available server` no Traefik | mesmo motivo: container fora da network do Traefik | idem                                            |
| `container_name` ignorado        | Coolify prefixa com o nome do projeto              | usar o **nome do serviço** como hostname        |
| envs duplicadas                  | `PATCH /envs` com `uuid` cria duplicata            | atualizar por `key`                             |

## Cloudflare

- **SSE**: o Cloudflare derruba conexões ociosas em ~100s. `/api/v1/events/stream`
  emite a cada 5s justamente por isso.
- **Compressão**: não habilitar `@fastify/compress` — bufferiza o stream e quebra o SSE.
- **Bot Fight Mode**: pode bloquear o POST do app mobile. Testar com o app real.
- **Cache**: as rotas de métricas mandam `Cache-Control: no-store`.
