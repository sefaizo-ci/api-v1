import { Injectable } from '@nestjs/common';
import { NotFoundException } from '../../../libs/exceptions/domain.exceptions';
import {
  NotificationChannel,
  NotificationStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../libs/database/prisma.service';
import { RegisterNotificationDeviceDto } from '../interface/dtos/register-notification-device.dto';
import { NotificationQueueService } from './notification-queue.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: NotificationQueueService,
  ) {}

  async registerDevice(
    userId: string,
    dto: RegisterNotificationDeviceDto,
  ): Promise<void> {
    await this.prisma.notificationDevice.upsert({
      where: {
        userId_platform_deviceId: {
          userId,
          platform: dto.platform,
          deviceId: dto.deviceId,
        },
      },
      create: {
        userId,
        platform: dto.platform,
        deviceId: dto.deviceId,
        pushToken: dto.pushToken,
        isActive: true,
        lastSeenAt: new Date(),
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
      update: {
        pushToken: dto.pushToken,
        isActive: true,
        lastSeenAt: new Date(),
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        deletedAt: null,
      },
    });
  }

  async listMyInAppNotifications(args: {
    userId: string;
    page?: number;
    limit?: number;
    status?: 'ALL' | 'READ' | 'UNREAD';
  }) {
    const page = args.page && args.page > 0 ? args.page : 1;
    const limit = args.limit && args.limit > 0 ? Math.min(args.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      userId: args.userId,
      channel: NotificationChannel.IN_APP,
      deletedAt: null,
    };

    if (args.status === 'READ') {
      where.status = NotificationStatus.READ;
    }

    if (args.status === 'UNREAD') {
      where.status = {
        not: NotificationStatus.READ,
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
        channel: NotificationChannel.IN_APP,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification introuvable');
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        channel: NotificationChannel.IN_APP,
        status: {
          not: NotificationStatus.READ,
        },
        deletedAt: null,
      },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    });
  }

  async createFanoutNotification(args: {
    userId: string;
    type: string;
    title: string;
    body: string;
    channels: NotificationChannel[];
    metadata?: Prisma.InputJsonValue;
    scheduledFor?: Date;
  }): Promise<void> {
    const uniqueChannels = [...new Set(args.channels)];

    for (const channel of uniqueChannels) {
      const isInApp = channel === NotificationChannel.IN_APP;

      const notification = await this.prisma.notification.create({
        data: {
          userId: args.userId,
          type: args.type,
          channel,
          title: args.title,
          body: args.body,
          status: isInApp
            ? NotificationStatus.SENT
            : NotificationStatus.PENDING,
          sentAt: isInApp ? new Date() : null,
          scheduledFor: args.scheduledFor,
          metadata: args.metadata,
        },
      });

      if (!isInApp) {
        await this.queueService.enqueueDispatch(
          notification.id,
          args.scheduledFor,
        );
      }
    }
  }
}
