const SECRET_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  { pattern: /(authorization\s*[:=]\s*)(bearer\s+)?[^\s"']+/gi, replacement: '$1***' },
  {
    pattern: /((?:password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*)[^\s"',]+/gi,
    replacement: '$1***',
  },
  { pattern: /(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+(@)/gi, replacement: '$1***$2' },
  { pattern: /(redis:\/\/[^:\s]*:)[^@\s]+(@)/gi, replacement: '$1***$2' },
];

/** Mascara segredos antes de expor logs na API ou mandar para o LLM. */
export function sanitizeSecrets(text: string): string {
  return SECRET_PATTERNS.reduce(
    (acc, { pattern, replacement }) => acc.replace(pattern, replacement),
    text,
  );
}

/** Limita o tamanho para não estourar o contexto do modelo. */
export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  return `${text.slice(0, maxChars)}\n… (truncado, ${text.length - maxChars} caracteres omitidos)`;
}
