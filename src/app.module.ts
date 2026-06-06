import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './libs/config/env.validation';
import { DatabaseModule } from './libs/database/database.module';
import { ContextInterceptor } from './libs/interceptors/context.interceptor';
import { RedisModule } from './libs/redis/redis.module';
import { ClientModule } from './modules/client/client.module';
import { MediaModule } from './modules/media/media.module';
import { ProfessionalModule } from './modules/professional/professional.module';
import { PulseModule } from './modules/pulse/pulse.module';
import { ReviewModule } from './modules/review/review.module';
import { ApiKeyGuard } from './modules/sentinel/infrastructure/guards/api-key.guard';
import { JwtAuthGuard } from './modules/sentinel/infrastructure/guards/jwt-auth.guard';
import { SentinelModule } from './modules/sentinel/sentinel.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: false,
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: 'SYS:standard',
                },
              }
            : undefined,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers["x-api-key"]',
            'req.headers.cookie',
          ],
          censor: '[REDACTED]',
        },
        level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
      },
    }),
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
    ReviewModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: ContextInterceptor },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
