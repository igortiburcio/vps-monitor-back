import { describe, expect, it } from 'bun:test';

import { percentage } from '../../src/domain/entities/host-metrics.js';

describe('percentage', () => {
  it('calcula com uma casa decimal', () => {
    expect(percentage(2_000, 8_000)).toBe(25);
    expect(percentage(1, 3)).toBe(33.3);
  });

  it('retorna null quando falta dado', () => {
    expect(percentage(null, 8_000)).toBeNull();
    expect(percentage(2_000, null)).toBeNull();
  });

  it('retorna null quando o total é zero ou negativo', () => {
    expect(percentage(10, 0)).toBeNull();
    expect(percentage(10, -5)).toBeNull();
  });

  it('nunca passa de 100', () => {
    expect(percentage(20_000, 8_000)).toBe(100);
  });
});
