import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });

    this.client.on('error', (error: Error) => {
      this.logger.warn(`Redis error: ${error.message}`);
    });

    void this.client.connect().catch((error: Error) => {
      this.logger.warn(
        `Redis connection unavailable at startup: ${error.message}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async setWithExpiry(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async incrementWithWindow(
    key: string,
    windowSeconds: number,
  ): Promise<number> {
    const value = await this.client.incr(key);
    if (value === 1) {
      await this.client.expire(key, windowSeconds);
    }
    return value;
  }
}
