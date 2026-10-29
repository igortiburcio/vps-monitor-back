import { describe, expect, it } from 'bun:test';

import { CheckHealthUseCase } from '../../src/application/use-cases/check-health.use-case.js';
import { FakeHealthProbe } from '../fakes/index.js';

const up = (name: string) => new FakeHealthProbe(name, { name, status: 'up', responseTimeMs: 3 });
const down = (name: string) =>
  new FakeHealthProbe(name, { name, status: 'down', message: 'sem conexão' });

describe('CheckHealthUseCase', () => {
  it('retorna ok quando todos os probes estão de pé', async () => {
    const useCase = new CheckHealthUseCase([up('database'), up('process')]);

    const report = await useCase.execute();

    expect(report.status).toBe('ok');
    expect(Object.keys(report.info)).toEqual(['database', 'process']);
    expect(report.error).toEqual({});
  });

  it('retorna error quando algum probe falha', async () => {
    const useCase = new CheckHealthUseCase([up('process'), down('database')]);

    const report = await useCase.execute();

    expect(report.status).toBe('error');
    expect(report.error.database?.status).toBe('down');
    expect(report.details.process?.status).toBe('up');
  });

  it('liveness ignora dependências', async () => {
    const useCase = new CheckHealthUseCase([up('process'), down('database')]);

    const report = await useCase.execute({ includeDependencies: false });

    expect(report.status).toBe('ok');
    expect(Object.keys(report.info)).toEqual(['process']);
  });

  it('converte exceção do probe em down', async () => {
    const exploding = new FakeHealthProbe('docker', { name: 'docker', status: 'up' });
    exploding.probe = () => Promise.reject(new Error('timeout'));

    const report = await new CheckHealthUseCase([exploding]).execute();

    expect(report.status).toBe('error');
    expect(report.error.docker?.message).toBe('timeout');
  });
});
