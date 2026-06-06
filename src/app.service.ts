import { Injectable } from '@nestjs/common';
import { PrismaService } from './libs/database/prisma.service';
import { RedisService } from './libs/redis/redis.service';

export interface HealthStatus {
  success: boolean;
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
  checks: {
    postgres: 'ok' | 'error';
    redis: 'ok' | 'error';
  };
}

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getHealth(): Promise<HealthStatus> {
    const [postgresOk, redisOk] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      this.redis.ping(),
    ]);

    const allOk = postgresOk && redisOk;

    return {
      success: allOk,
      status: allOk ? 'ok' : 'degraded',
      service: 'sefaizo-api',
      timestamp: new Date().toISOString(),
      checks: {
        postgres: postgresOk ? 'ok' : 'error',
        redis: redisOk ? 'ok' : 'error',
      },
    };
  }
}
