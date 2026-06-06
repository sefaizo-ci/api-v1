import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../libs/decorators/roles.decorator';
import { RolesGuard } from '../sentinel/infrastructure/guards/roles.guard';
import { NotificationsService } from './application/notifications.service';
import { ListNotificationsDto } from './interface/dtos/list-notifications.dto';
import { RegisterNotificationDeviceDto } from './interface/dtos/register-notification-device.dto';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    role: string;
    roles?: string[];
  };
};

@Controller('pulse')
@UseGuards(RolesGuard)
@Roles('CLIENT', 'PROFESSIONAL', 'ADMIN')
export class PulseController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('devices/register')
  async registerDevice(
    @Req() req: AuthenticatedRequest,
    @Body() body: RegisterNotificationDeviceDto,
  ) {
    await this.notificationsService.registerDevice(req.user.id, body);
    return {
      success: true,
    };
  }

  @Get('me')
  async listMyNotifications(
    @Req() req: AuthenticatedRequest,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query() query?: ListNotificationsDto,
  ) {
    return this.notificationsService.listMyInAppNotifications({
      userId: req.user.id,
      page,
      limit,
      status: query?.status,
    });
  }

  @Patch('me/:notificationId/read')
  async markAsRead(
    @Req() req: AuthenticatedRequest,
    @Param('notificationId') notificationId: string,
  ) {
    await this.notificationsService.markAsRead(req.user.id, notificationId);
    return {
      success: true,
    };
  }

  @Patch('me/read-all')
  async markAllAsRead(@Req() req: AuthenticatedRequest) {
    await this.notificationsService.markAllAsRead(req.user.id);
    return {
      success: true,
    };
  }
}
