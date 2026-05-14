import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsOptions, Queue } from 'bullmq';
import {
  DISPATCH_NOTIFICATION_JOB,
  NOTIFICATIONS_QUEUE,
} from '../constants/notification.constants';

@Injectable()
export class NotificationQueueService implements OnModuleDestroy {
  private readonly connection: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    db?: number;
    tls?: Record<string, never>;
  };
  private readonly queue: Queue;

  constructor(private readonly configService: ConfigService) {
    this.connection = this.buildConnection();
    this.queue = new Queue(NOTIFICATIONS_QUEUE, {
      connection: this.connection,
    });
  }

  async enqueueDispatch(
    notificationId: string,
    scheduledFor?: Date,
  ): Promise<void> {
    const now = Date.now();
    const delay = scheduledFor ? Math.max(scheduledFor.getTime() - now, 0) : 0;

    const options: JobsOptions = {
      jobId: `notification_${notificationId}`,
      delay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 500,
      removeOnFail: 1000,
    };

    await this.queue.add(
      DISPATCH_NOTIFICATION_JOB,
      {
        notificationId,
      },
      options,
    );
  }

  getConnection() {
    return this.connection;
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }

  private buildConnection(): {
    host: string;
    port: number;
    username?: string;
    password?: string;
    db?: number;
    tls?: Record<string, never>;
  } {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';

    const parsed = new URL(redisUrl);
    const dbPath = parsed.pathname.replace('/', '');
    const db = dbPath ? Number.parseInt(dbPath, 10) : undefined;

    return {
      host: parsed.hostname,
      port: parsed.port ? Number.parseInt(parsed.port, 10) : 6379,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      db: Number.isNaN(db) ? undefined : db,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    };
  }
}
