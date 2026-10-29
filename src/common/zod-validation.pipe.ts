import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Validação de entrada com Zod.
 * (nestjs-zod ainda não suporta Nest 12, então mantemos um pipe mínimo.)
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Parâmetros inválidos',
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    return result.data;
  }
}
