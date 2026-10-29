import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from '../../app.module.js';

/**
 * Gera openapi.json — insumo do app React Native
 * (openapi-typescript + openapi-fetch).
 */
const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
  bodyParser: false,
  logger: false,
});

try {
  const config = new DocumentBuilder()
    .setTitle('VPS Monitor API')
    .setDescription('Métricas da VPS, containers e chat com LLM')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const output = resolve(process.cwd(), 'openapi.json');

  writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);

  console.log(`openapi.json gerado em ${output}`);
} finally {
  await app.close();
}
