import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BookingReferenceController } from './booking-reference.controller';
import { ClientController } from './client.controller';
import {
  ClientCommandHandlers,
  ClientQueryHandlers,
} from './interface/handlers';

@Module({
  imports: [CqrsModule],
  controllers: [ClientController, BookingReferenceController],
  providers: [...ClientCommandHandlers, ...ClientQueryHandlers],
})
export class ClientModule {}
