import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { APP } from './common/constants/routes';
import { GlobalExceptionFilter } from './libs/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('HttpTrace');

  app.use(helmet());

  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header('x-request-id');
    const requestId = incoming && incoming.trim() ? incoming : randomUUID();
    const start = Date.now();

    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      logger.log(
        `[requestId=${requestId}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`,
      );
    });

    next();
  });

  app.setGlobalPrefix(APP.API.PREFIX, {
    exclude: [
      { path: APP.HEALTH, method: RequestMethod.GET },
      { path: APP.ROOT, method: RequestMethod.GET },
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(cookieParser());

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((o) =>
    o.trim(),
  );
  if (!allowedOrigins && process.env.NODE_ENV === 'production') {
    throw new Error('ALLOWED_ORIGINS must be set in production');
  }

  app.enableCors({
    origin: allowedOrigins ?? true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Sefaizo API')
    .setDescription(
      'API documentation for Sefaizo backend services. All /auth routes require the x-api-key header. Protected routes also require Bearer JWT.',
    )
    .setVersion('1.0')
    .addServer(`/`)
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API key required to access the API',
      },
      'x-api-key',
    )
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(APP.DOCS.BASE, app, swaggerDocument);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(
    `SEFAIZO API running on http://localhost:${port}/${APP.API.PREFIX}`,
  );
}
void bootstrap();
