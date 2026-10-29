import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { GetDiagnosticsUseCase } from '../../application/use-cases/get-diagnostics.use-case.js';

@ApiTags('diagnostics')
@ApiBearerAuth()
@Controller('api/v1/diagnostics')
export class DiagnosticsController {
  constructor(private readonly getDiagnostics: GetDiagnosticsUseCase) {}

  /** Estado de cada coletor: responde "por que a seção X está vazia?". */
  @Get()
  async check() {
    return this.getDiagnostics.execute();
  }
}
