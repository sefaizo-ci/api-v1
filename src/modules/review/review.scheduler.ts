import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReviewerType } from '@prisma/client';
import { PrismaService } from '../../libs/database/prisma.service';
import { ReviewSessionRevealedEvent } from './interface/events';

@Injectable()
export class ReviewSchedulerService {
  private readonly logger = new Logger(ReviewSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async revealExpiredSessions(): Promise<void> {
    const now = new Date();

    const expiredSessions = await this.prisma.reviewSession.findMany({
      where: {
        expiresAt: { lte: now },
        revealedAt: null,
      },
      include: {
        reviews: {
          where: { deletedAt: null },
          select: { id: true, professionalId: true },
        },
      },
    });

    if (expiredSessions.length === 0) return;

    this.logger.log(
      `Révélation de ${expiredSessions.length} session(s) d'avis expirées`,
    );

    for (const session of expiredSessions) {
      if (session.reviews.length === 0) {
        await this.prisma.reviewSession.update({
          where: { id: session.id },
          data: { revealedAt: now },
        });
        continue;
      }

      const professionalId = session.reviews[0].professionalId;

      await this.prisma.$transaction(async (tx) => {
        await tx.review.updateMany({
          where: { sessionId: session.id, deletedAt: null },
          data: { isVisible: true },
        });

        await tx.reviewSession.update({
          where: { id: session.id },
          data: { revealedAt: now },
        });

        const agg = await tx.review.aggregate({
          where: {
            professionalId,
            reviewerType: ReviewerType.CLIENT,
            isVisible: true,
            deletedAt: null,
          },
          _avg: { rating: true },
          _count: { id: true },
        });

        await tx.professional.update({
          where: { id: professionalId },
          data: {
            rating: agg._avg.rating ?? 0,
            reviewCount: agg._count.id,
          },
        });
      });

      this.eventBus.publish(
        new ReviewSessionRevealedEvent(session.id, session.bookingId),
      );
    }
  }
}
