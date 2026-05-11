import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './libs/database/database.module';
import { RedisModule } from './libs/redis/redis.module';
import { ClientModule } from './modules/client/client.module';
import { MediaModule } from './modules/media/media.module';
import { ProfessionalModule } from './modules/professional/professional.module';
import { PulseModule } from './modules/pulse/pulse.module';
import { ApiKeyGuard } from './modules/sentinel/infrastructure/guards/api-key.guard';
import { SentinelModule } from './modules/sentinel/sentinel.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    DatabaseModule,
    RedisModule,
    SentinelModule,
    ClientModule,
    MediaModule,
    ProfessionalModule,
    PulseModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
