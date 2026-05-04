import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
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
    ConfigModule.forRoot({
      isGlobal: true,
    }),
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
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule {}
