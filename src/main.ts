import {
  RequestMethod,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { EnvironmentVariables } from './libs/config/env.validation';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { APP } from './common/constants/routes';
import { mountBullBoard } from './libs/bull-board/bull-board.setup';
import { GlobalExceptionFilter } from './libs/filters/http-exception.filter';
import { setupSwagger } from './libs/swagger/swagger.setup';

function resolveAllowedOrigins(
  config: ConfigService<EnvironmentVariables>,
): string[] | true {
  const configured = config.get<string>('ALLOWED_ORIGINS');
  if (configured) {
    const origins = configured
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    if (origins.length) return origins;
  }

  const vercelOrigins = [
    config.get<string>('VERCEL_PROJECT_PRODUCTION_URL'),
    config.get<string>('VERCEL_BRANCH_URL'),
    config.get<string>('VERCEL_URL'),
  ]
    .filter((o): o is string => Boolean(o))
    .map((o) => `https://${o}`);

  if (vercelOrigins.length > 0) {
    return vercelOrigins;
  }

  if (config.get<string>('NODE_ENV') === 'production') {
    throw new Error('ALLOWED_ORIGINS must be set in production');
  }

  return true;
}

export async function createNestApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get<ConfigService<EnvironmentVariables>>(ConfigService);

  app.use(helmet());

  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header('x-request-id');
    const requestId = incoming && incoming.trim() ? incoming : randomUUID();
    res.setHeader('x-request-id', requestId);
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

  mountBullBoard(app);
  setupSwagger(app);

  app.enableCors({
    origin: resolveAllowedOrigins(config),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  return app;
}

async function bootstrap() {
  const app = await createNestApp();
  const config = app.get<ConfigService<EnvironmentVariables>>(ConfigService);
  const logger = app.get(Logger);

  const port = config.get<string>('PORT') ?? 3000;
  await app.listen(port);
  logger.log(
    `SEFAIZO API running on http://localhost:${port}/${APP.API.PREFIX}`,
  );
}

if (!process.env.VERCEL) {
  void bootstrap();
}
