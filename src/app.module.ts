import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './libs/database/database.module';
import { RedisModule } from './libs/redis/redis.module';
import { ClientModule } from './modules/client/client.module';
import { MediaModule } from './modules/media/media.module';
import { ProfessionalModule } from './modules/professional/professional.module';
import { PulseModule } from './modules/pulse/pulse.module';
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
  providers: [AppService],
})
export class AppModule {}
