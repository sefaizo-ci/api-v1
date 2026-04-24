import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import {
  DISPATCH_NOTIFICATION_JOB,
  NOTIFICATIONS_QUEUE,
} from '../constants/notification.constants';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationQueueService } from './notification-queue.service';

@Injectable()
export class NotificationWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationWorkerService.name);
  private worker?: Worker;

  constructor(
    private readonly queueService: NotificationQueueService,
    private readonly deliveryService: NotificationDeliveryService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      NOTIFICATIONS_QUEUE,
      async (job: Job<{ notificationId: string }>) => {
        if (job.name !== DISPATCH_NOTIFICATION_JOB) {
          return;
        }

        await this.deliveryService.dispatch(job.data.notificationId);
      },
      {
        connection: this.queueService.getConnection(),
        concurrency: 10,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.debug(`Notification job completed: ${job.id}`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.warn(
        `Notification job failed: ${job?.id ?? 'unknown'} - ${error.message}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
