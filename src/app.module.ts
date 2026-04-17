import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './libs/database/database.module';
import { RedisModule } from './libs/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProfessionalModule } from './modules/professional/professional.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    ProfessionalModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
