import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { NotificationDeliveryService } from './application/notification-delivery.service';
import { NotificationQueueService } from './application/notification-queue.service';
import { NotificationWorkerService } from './application/notification-worker.service';
import { NotificationsService } from './application/notifications.service';
import { NotificationEventHandlers } from './interface/handlers';
import { PulseController } from './pulse.controller';

@Module({
  imports: [CqrsModule],
  controllers: [PulseController],
  providers: [
    NotificationsService,
    NotificationQueueService,
    NotificationDeliveryService,
    NotificationWorkerService,
    ...NotificationEventHandlers,
  ],
})
export class PulseModule {}
