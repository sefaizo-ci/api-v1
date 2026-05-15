import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DatabaseModule } from '../../libs/database/database.module';
import {
  BookingCancelledReviewHandler,
  BookingCancellationApprovedReviewHandler,
  BookingCompletedReviewHandler,
  EditReviewHandler,
  GetClientReviewsHandler,
  GetMyReviewSessionsHandler,
  GetProfessionalReviewsHandler,
  SubmitReviewHandler,
} from './interface/handlers';
import { ReviewController } from './review.controller';
import { ReviewSchedulerService } from './review.scheduler';

const Handlers = [
  SubmitReviewHandler,
  EditReviewHandler,
  BookingCompletedReviewHandler,
  BookingCancelledReviewHandler,
  BookingCancellationApprovedReviewHandler,
  GetProfessionalReviewsHandler,
  GetClientReviewsHandler,
  GetMyReviewSessionsHandler,
];

@Module({
  imports: [CqrsModule, DatabaseModule],
  controllers: [ReviewController],
  providers: [...Handlers, ReviewSchedulerService],
})
export class ReviewModule {}
