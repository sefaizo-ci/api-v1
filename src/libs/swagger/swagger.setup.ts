import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { APP } from '../../common/constants/routes';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Sefaizo API')
    .setDescription(
      'API documentation for Sefaizo backend services. All /auth routes require the x-api-key header. Protected routes also require Bearer JWT.',
    )
    .setVersion('1.0')
    .addServer('/')
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

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(APP.DOCS.BASE, app, document);
}
