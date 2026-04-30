import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Request } from 'express';
import { Roles } from '../../libs/decorators/roles.decorator';
import { JwtAuthGuard } from '../sentinel/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../sentinel/infrastructure/guards/roles.guard';
import {
  CreateClientBookingCommand,
  RequestBookingCancellationCommand,
  UpdatePendingBookingCommand,
} from './interface/commands';
import {
  CreateClientBookingDto,
  RequestBookingCancellationDto,
  UpdatePendingBookingDto,
} from './interface/dtos';
import { GetMyBookingByIdQuery, GetMyBookingsQuery } from './interface/queries';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENT')
export class ClientController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('me/bookings')
  async createBooking(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateClientBookingDto,
  ) {
    return this.commandBus.execute<CreateClientBookingCommand, unknown>(
      new CreateClientBookingCommand(
        req.user.id,
        body.professionalId,
        body.serviceId,
        body.scheduledAt,
        body.commune,
        body.address,
        body.clientNotes,
      ),
    );
  }

  @Patch('me/bookings/:bookingId')
  async updatePendingBooking(
    @Req() req: AuthenticatedRequest,
    @Param('bookingId') bookingId: string,
    @Body() body: UpdatePendingBookingDto,
  ) {
    return this.commandBus.execute<UpdatePendingBookingCommand, unknown>(
      new UpdatePendingBookingCommand(
        bookingId,
        req.user.id,
        body.scheduledAt,
        body.commune,
        body.address,
        body.clientNotes,
      ),
    );
  }

  @Post('me/bookings/:bookingId/cancellation-request')
  async requestCancellation(
    @Req() req: AuthenticatedRequest,
    @Param('bookingId') bookingId: string,
    @Body() body: RequestBookingCancellationDto,
  ) {
    return this.commandBus.execute<RequestBookingCancellationCommand, unknown>(
      new RequestBookingCancellationCommand(
        bookingId,
        req.user.id,
        body.reason,
      ),
    );
  }

  @Get('me/bookings')
  async listMyBookings(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.queryBus.execute<GetMyBookingsQuery, unknown>(
      new GetMyBookingsQuery(req.user.id, status, page, limit),
    );
  }

  @Get('me/bookings/:bookingId')
  async getMyBooking(
    @Req() req: AuthenticatedRequest,
    @Param('bookingId') bookingId: string,
  ) {
    return this.queryBus.execute<GetMyBookingByIdQuery, unknown>(
      new GetMyBookingByIdQuery(bookingId, req.user.id),
    );
  }
}
