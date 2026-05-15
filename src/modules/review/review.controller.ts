import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../sentinel/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../libs/decorators/current-user.decorator';
import { SubmitReviewDto, EditReviewDto } from './interface/dtos';
import { SubmitReviewCommand, EditReviewCommand } from './interface/commands';
import {
  GetProfessionalReviewsQuery,
  GetClientReviewsQuery,
  GetMyReviewSessionsQuery,
} from './interface/queries';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
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
  @UseGuards()
  getProfessionalReviews(@Param('professionalId') professionalId: string) {
    return this.queryBus.execute(new GetProfessionalReviewsQuery(professionalId));
  }

  @Get('clients/:clientId')
  getClientReviews(
    @Param('clientId') clientId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.queryBus.execute(
      new GetClientReviewsQuery(clientId, user.id),
    );
  }

  @Get('sessions/me')
  getMyReviewSessions(@CurrentUser() user: { id: string }) {
    return this.queryBus.execute(new GetMyReviewSessionsQuery(user.id));
  }
}
