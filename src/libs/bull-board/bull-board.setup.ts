import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { EnvironmentVariables } from '../config/env.validation';
import { NotificationQueueService } from '../../modules/pulse/application/notification-queue.service';

export function mountBullBoard(app: INestApplication): void {
  const config = app.get<ConfigService<EnvironmentVariables>>(ConfigService);
  const password = config.get<string>('BULL_BOARD_PASSWORD');
  const nodeEnv = config.get<string>('NODE_ENV');

  if (!password && nodeEnv === 'production') {
    return;
  }

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  const queueService = app.get(NotificationQueueService);
  createBullBoard({
    queues: [new BullMQAdapter(queueService.getQueue())],
    serverAdapter,
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const router = serverAdapter.getRouter();

  if (password) {
    app.use(
      '/admin/queues',
      (req: Request, res: Response, next: NextFunction) => {
        const auth = req.headers['authorization'];
        const expected = `Basic ${Buffer.from(`:${password}`).toString('base64')}`;
        if (auth !== expected) {
          res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
          return res.status(401).send('Unauthorized');
        }
        next();
      },
    );
  }

  app.use('/admin/queues', router);
}
