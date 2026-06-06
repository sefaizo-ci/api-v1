import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { MediaModule } from '../media/media.module';
import { SentinelModule } from '../sentinel/sentinel.module';
import { ProfessionalAdminController } from './admin.controller';
import { ProfessionalRepository } from './infrastructure/persistence/professional.repository';
import {
  ProfessionalCommandHandlers,
  ProfessionalQueryHandlers,
} from './interface/handlers';
import { ProfessionalController } from './professional.controller';
import { ProfessionalSchedulerService } from './professional.scheduler';

@Module({
  imports: [CqrsModule, ScheduleModule.forRoot(), MediaModule, SentinelModule],
  controllers: [ProfessionalController, ProfessionalAdminController],
  providers: [
    ProfessionalRepository,
    ProfessionalSchedulerService,
    ...ProfessionalCommandHandlers,
    ...ProfessionalQueryHandlers,
  ],
  exports: [ProfessionalRepository],
})
export class ProfessionalModule {}
