import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module.js';
import { env, isProduction } from './config/env.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // Cloudflare + Traefik na frente: confia em X-Forwarded-*
      trustProxy: true,
      bodyLimit: 1_000_000,
    }),
    // O @thallesp readiciona os parsers (inclusive no Fastify)
    { bodyParser: false },
  );

  app.enableCors({
    origin: isProduction ? [env.APP_URL] : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('VPS Monitor API')
    .setDescription('Métricas da VPS, containers e chat com LLM')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
  });

  await app.listen(env.PORT, '0.0.0.0');

  Logger.log(`API ouvindo em ${await app.getUrl()}`, 'Bootstrap');
  Logger.log(`Swagger em ${await app.getUrl()}/api/docs`, 'Bootstrap');
}

await bootstrap();
