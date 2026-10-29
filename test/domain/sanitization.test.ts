import { describe, expect, it } from 'bun:test';

import { sanitizeSecrets, truncate } from '../../src/domain/sanitization.js';

describe('sanitizeSecrets', () => {
  it('mascara senha em formato chave=valor', () => {
    const result = sanitizeSecrets('DB_PASSWORD=super-secreto\nhost=localhost');

    expect(result).not.toContain('super-secreto');
    expect(result).toContain('host=localhost');
  });

  it('mascara token e api key', () => {
    const result = sanitizeSecrets('token=abc123 api_key: xyz789');

    expect(result).not.toContain('abc123');
    expect(result).not.toContain('xyz789');
  });

  it('mascara header Authorization', () => {
    const result = sanitizeSecrets('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9');

    expect(result).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('mascara a senha de uma URL de conexão', () => {
    const result = sanitizeSecrets('postgres://user:minhaSenha@db:5432/app');

    expect(result).not.toContain('minhaSenha');
    expect(result).toContain('postgres://user:***@db:5432/app');
  });

  it('não altera texto sem segredos', () => {
    const text = 'container iniciado em 3s';

    expect(sanitizeSecrets(text)).toBe(text);
  });
});

describe('truncate', () => {
  it('mantém texto curto intacto', () => {
    expect(truncate('abc', 10)).toBe('abc');
  });

  it('corta e informa quantos caracteres foram omitidos', () => {
    const result = truncate('x'.repeat(100), 10);

    expect(result).toContain('truncado, 90 caracteres omitidos');
  });
});
