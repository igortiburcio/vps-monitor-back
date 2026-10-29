import { describe, expect, it } from 'bun:test';

import { envSchema } from '../src/config/env.js';

const base = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
};

describe('envSchema', () => {
  it('aplica defaults quando só o obrigatório é informado', () => {
    const parsed = envSchema.parse(base);

    expect(parsed.PORT).toBe(3000);
    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.METRICS_INTERVAL_MS).toBe(15_000);
    expect(parsed.LLM_MODEL).toBe('openai/gpt-oss-20b');
    expect(parsed.HOST_PROC).toBe('/proc');
  });

  it('rejeita segredo de auth curto', () => {
    const result = envSchema.safeParse({ ...base, BETTER_AUTH_SECRET: 'curto' });

    expect(result.success).toBe(false);
  });

  it('rejeita DATABASE_URL ausente', () => {
    const result = envSchema.safeParse({ BETTER_AUTH_SECRET: 'x'.repeat(32) });

    expect(result.success).toBe(false);
  });

  it('coage PORT de string para número', () => {
    const parsed = envSchema.parse({ ...base, PORT: '8080' });

    expect(parsed.PORT).toBe(8080);
  });

  it('recusa intervalo de coleta abaixo de 5s', () => {
    const result = envSchema.safeParse({ ...base, METRICS_INTERVAL_MS: '100' });

    expect(result.success).toBe(false);
  });
});
