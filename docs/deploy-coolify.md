# Deploy no Coolify

Alvo: `https://monitor.duduisonfire.com` (Cloudflare → Traefik).

## 1. Repositório

O Coolify precisa clonar o código. Crie o repo no GitHub e faça o push:

```bash
cd vps-monitor-back
gh repo create vps-monitor-back --private --source=. --remote=origin --push
```

## 2. Proxy do socket do Docker

Crie um recurso **Docker Compose** no Coolify usando `compose.yaml` deste repo.

Ele expõe a API do Docker em `docker-socket-proxy:2375` **somente leitura**
(`CONTAINERS=1`, `POST=0`). Nunca monte `/var/run/docker.sock` direto na API:
o socket cru equivale a root no host.

## 3. Aplicação

Crie uma aplicação do tipo **Dockerfile** apontando para o repo, porta **3000**.

### Variáveis de ambiente

| Variável             | Valor                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| `NODE_ENV`           | `production`                                                               |
| `PORT`               | `3000`                                                                     |
| `APP_URL`            | `https://monitor.duduisonfire.com`                                         |
| `BETTER_AUTH_URL`    | `https://monitor.duduisonfire.com`                                         |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`                                                  |
| `DATABASE_URL`       | `postgres://vps_monitor:<senha>@b2wlwdr0njjgsy24kukzd0yf:5432/vps_monitor` |
| `HOST_PROC`          | `/host/proc`                                                               |
| `HOST_SYS`           | `/host/sys`                                                                |
| `HOST_ROOT`          | `/host/root`                                                               |
| `DOCKER_PROXY_URL`   | `http://docker-socket-proxy:2375`                                          |
| `COOLIFY_URL`        | `https://coolify.duduisonfire.com`                                         |
| `COOLIFY_TOKEN`      | token **somente leitura**                                                  |
| `LLM_PROVIDER`       | `groq`                                                                     |
| `GROQ_API_KEY`       | chave da Groq                                                              |
| `LLM_MODEL`          | `openai/gpt-oss-20b`                                                       |

> `DATABASE_ADMIN_URL` **não** deve existir no container. O banco é criado pelo
> `bun run db:setup` a partir da máquina local; no container as migrations rodam
> com `DATABASE_URL` (a role `vps_monitor` é dona do banco).

### Custom Docker Options (obrigatório para métricas do host)

```
--volume /proc:/host/proc:ro --volume /sys:/host/sys:ro --volume /:/host/root:ro
```

Sem isso o container lê o `/proc` dele mesmo e as métricas não representam a VPS.

### Rede

A app precisa estar na mesma network do `docker-socket-proxy` e do Postgres
(`coolify`). O hostname interno do Postgres é o UUID do banco:
`b2wlwdr0njjgsy24kukzd0yf`.

### Healthcheck

- Path: `/health`
- Porta: `3000`
- Esperado: `200` com `{"status":"ok"}`

## 4. Validação

```bash
curl -s https://monitor.duduisonfire.com/health
curl -s -X POST https://monitor.duduisonfire.com/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"...","password":"..."}'
```

## 5. Atenção com Cloudflare

- **SSE**: o Cloudflare derruba conexões ociosas em ~100s. O endpoint
  `/api/v1/events/stream` emite a cada 5s justamente por isso.
- **Compressão**: não habilitar `@fastify/compress` — bufferiza o stream e quebra o SSE.
- **Bot Fight Mode**: se estiver ativo, pode bloquear o POST do app mobile.
  Teste com o app real, não só com `curl`.
- **Cache**: as rotas de métricas mandam `Cache-Control: no-store`.
