import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MediaModule } from '../media/media.module';
import { ProfessionalAdminController } from './admin.controller';
import { ProfessionalRepository } from './infrastructure/persistence/professional.repository';
import {
  ProfessionalCommandHandlers,
  ProfessionalQueryHandlers,
} from './interface/handlers';
import { ProfessionalController } from './professional.controller';

@Module({
  imports: [CqrsModule, MediaModule],
  controllers: [ProfessionalController, ProfessionalAdminController],
  providers: [
    ProfessionalRepository,
    ...ProfessionalCommandHandlers,
    ...ProfessionalQueryHandlers,
  ],
  exports: [ProfessionalRepository],
})
export class ProfessionalModule {}
