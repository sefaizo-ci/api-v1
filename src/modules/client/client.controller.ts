import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Request } from 'express';
import { Roles } from '../../libs/decorators/roles.decorator';
import { CancelBookingCommand } from '../professional/interface/commands/booking.commands';
import { JwtAuthGuard } from '../sentinel/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../sentinel/infrastructure/guards/roles.guard';
import {
  CreateClientBookingCommand,
  RequestBookingCancellationCommand,
} from './interface/commands';
import {
  CreateClientBookingDto,
  RequestBookingCancellationDto,
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
        body.serviceIds,
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

  @Delete('me/bookings/:bookingId')
  async cancelBooking(
    @Req() req: AuthenticatedRequest,
    @Param('bookingId') bookingId: string,
    @Body() body: RequestBookingCancellationDto,
  ) {
    return this.commandBus.execute<CancelBookingCommand, unknown>(
      new CancelBookingCommand(bookingId, req.user.id, body.reason),
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
