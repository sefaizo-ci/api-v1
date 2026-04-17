import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { APP } from './common/constants/routes';
import { GlobalExceptionFilter } from './libs/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
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
  console.log(
    `SEFAIZO API running on http://localhost:${port}/${APP.API.PREFIX}`,
  );
}
void bootstrap();
