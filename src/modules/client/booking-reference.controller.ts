import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Public } from '../../libs/decorators/public.decorator';
import { GetBookingStatusesQuery } from './interface/queries';

@Controller('bookings')
export class BookingReferenceController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('statuses')
  @Public()
  async listBookingStatuses() {
    return this.queryBus.execute<GetBookingStatusesQuery, unknown>(
      new GetBookingStatusesQuery(),
    );
  }
}
