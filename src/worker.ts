import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  const logger = app.get(Logger);
  logger.log('SEFAIZO Worker started', 'Worker');

  const shutdown = async (signal: string) => {
    logger.log(`${signal} received — draining active jobs...`, 'Worker');
    await app.close();
    logger.log('Worker stopped gracefully', 'Worker');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void bootstrap();
