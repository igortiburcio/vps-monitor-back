import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('api/v1/me')
export class MeController {
  /** Usado pelo app no boot para validar o token salvo. */
  @Get()
  me(@Session() session: UserSession) {
    return {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
      },
      expiresAt: session.session.expiresAt,
    };
  }
}
