import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService
 * Global singleton for database access using Prisma ORM
 * Handles connection lifecycle management
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    super({ adapter });

    this.logger.log(`Database target: ${this.describeConnection(databaseUrl)}`);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      await this.$queryRawUnsafe('SELECT 1');
      this.logger.log('Prisma connected successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Prisma connection failed: ${message}`);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected.');
  }

  private describeConnection(url: string): string {
    try {
      const parsed = new URL(url);
      const dbName = parsed.pathname.replace(/^\//, '') || '<unknown-db>';
      return `${parsed.protocol}//${parsed.hostname}:${parsed.port || '<default>'}/${dbName}`;
    } catch {
      return '<invalid DATABASE_URL format>';
    }
  }
}
