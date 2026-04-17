import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ProfessionalRepository } from './infrastructure/persistence/professional.repository';
import { ProfessionalController } from './interface/controllers/professional.controller';
import {
  ProfessionalCommandHandlers,
  ProfessionalQueryHandlers,
} from './interface/handlers';

@Module({
  imports: [CqrsModule],
  controllers: [ProfessionalController],
  providers: [
    ProfessionalRepository,
    ...ProfessionalCommandHandlers,
    ...ProfessionalQueryHandlers,
  ],
  exports: [ProfessionalRepository],
})
export class ProfessionalModule {}
