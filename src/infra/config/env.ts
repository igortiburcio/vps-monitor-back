import { z } from 'zod';

/**
 * Validação única do ambiente, executada no import.
 * Falha cedo (boot) em vez de estourar no meio de um request.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  /** Só usado pelo db:setup. Nunca deve existir no container da API. */
  DATABASE_ADMIN_URL: z.string().min(1).optional(),

  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET precisa de 32+ caracteres'),
  BETTER_AUTH_URL: z.url().optional(),

  SEED_EMAIL: z.email().optional(),
  SEED_PASSWORD: z.string().min(8).optional(),

  HOST_PROC: z.string().default('/proc'),
  HOST_SYS: z.string().default('/sys'),
  HOST_ROOT: z.string().default('/'),
  DOCKER_PROXY_URL: z.url().default('http://docker-socket-proxy:2375'),

  COOLIFY_API_URL: z.url().optional(),
  COOLIFY_API_TOKEN: z.string().optional(),

  /** Origens extras de CORS, separadas por vírgula (ex.: web em dev). */
  CORS_ORIGINS: z.string().optional(),

  LLM_PROVIDER: z.enum(['groq', 'deepseek']).default('groq'),
  GROQ_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default('openai/gpt-oss-20b'),

  METRICS_INTERVAL_MS: z.coerce.number().int().min(5000).default(15_000),
  METRICS_RETENTION_DAYS: z.coerce.number().int().min(1).default(30),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Configuração de ambiente inválida:\n${details}`);
  }

  return result.data;
}

export const env = parseEnv(process.env);

export const isProduction = env.NODE_ENV === 'production';

/**
 * Origens aceitas pelo CORS e pelo BetterAuth.
 * `APP_URL` é sempre a origem principal; `CORS_ORIGINS` adiciona extras
 * (ex.: o app web rodando em http://localhost:8081).
 */
export const allowedOrigins = [
  env.APP_URL,
  ...(env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
];
