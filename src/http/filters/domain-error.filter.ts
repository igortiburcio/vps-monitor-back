import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import {
  ContainerNotFoundError,
  ConversationNotFoundError,
  InvalidUserDataError,
} from '../../domain/errors/domain.errors.js';

/** Traduz erros de domínio para status HTTP, sem vazar detalhes internos. */
@Catch(ContainerNotFoundError, ConversationNotFoundError, InvalidUserDataError)
export class DomainErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainErrorFilter.name);

  catch(
    exception: ContainerNotFoundError | ConversationNotFoundError | InvalidUserDataError,
    host: ArgumentsHost,
  ): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();

    const status =
      exception instanceof InvalidUserDataError ? HttpStatus.BAD_REQUEST : HttpStatus.NOT_FOUND;

    if (status === HttpStatus.BAD_REQUEST) {
      this.logger.warn(exception.message);
    }

    void reply.status(status).send({
      statusCode: status,
      message: exception.message,
      error: exception.name,
    });
  }
}
