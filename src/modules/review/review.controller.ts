import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CurrentUser } from '../../libs/decorators/current-user.decorator';
import { Public } from '../../libs/decorators/public.decorator';
import { EditReviewCommand, SubmitReviewCommand } from './interface/commands';
import { EditReviewDto, SubmitReviewDto } from './interface/dtos';
import {
  GetClientReviewsQuery,
  GetMyReviewSessionsQuery,
  GetProfessionalReviewsQuery,
} from './interface/queries';

@Controller('reviews')
export class ReviewController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post(':bookingId')
  submitReview(
    @Param('bookingId') bookingId: string,
    @Body() dto: SubmitReviewDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.commandBus.execute(
      new SubmitReviewCommand(bookingId, user.id, dto.rating, dto.comment),
    );
  }

  @Patch(':reviewId')
  editReview(
    @Param('reviewId') reviewId: string,
    @Body() dto: EditReviewDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.commandBus.execute(
      new EditReviewCommand(reviewId, user.id, dto.rating, dto.comment),
    );
  }

  @Get('professionals/:professionalId')
  @Public()
  getProfessionalReviews(@Param('professionalId') professionalId: string) {
    return this.queryBus.execute(
      new GetProfessionalReviewsQuery(professionalId),
    );
  }

  @Get('clients/:clientId')
  getClientReviews(
    @Param('clientId') clientId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.queryBus.execute(new GetClientReviewsQuery(clientId, user.id));
  }

  @Get('sessions/me')
  getMyReviewSessions(@CurrentUser() user: { id: string }) {
    return this.queryBus.execute(new GetMyReviewSessionsQuery(user.id));
  }
}
