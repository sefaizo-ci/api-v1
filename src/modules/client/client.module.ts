import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ClientController } from './client.controller';
import {
  ClientCommandHandlers,
  ClientQueryHandlers,
} from './interface/handlers';

@Module({
  imports: [CqrsModule],
  controllers: [ClientController],
  providers: [...ClientCommandHandlers, ...ClientQueryHandlers],
})
export class ClientModule {}
