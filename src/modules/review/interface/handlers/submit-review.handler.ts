import { Injectable } from '@nestjs/common';
import {
  BadRequestException,
  NotFoundException,
} from '../../../../libs/exceptions/domain.exceptions';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { ReviewerType } from '@prisma/client';
import { PrismaService } from '../../../../libs/database/prisma.service';
import { SubmitReviewCommand } from '../commands';
import { ReviewSessionRevealedEvent } from '../events';

const REVIEW_WINDOW_HOURS = 48;
const EDIT_WINDOW_MINUTES = 30;

@CommandHandler(SubmitReviewCommand)
@Injectable()
export class SubmitReviewHandler implements ICommandHandler<SubmitReviewCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: SubmitReviewCommand): Promise<{ reviewId: string }> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: command.bookingId, deletedAt: null },
      include: {
        professional: { select: { id: true, userId: true } },
        reviewSession: { include: { reviews: true } },
      },
    });

    if (!booking) throw new NotFoundException('Reservation non trouvee');

    if (booking.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Les avis ne sont possibles que sur une prestation terminee',
      );
    }

    const session = booking.reviewSession;
    if (!session) {
      throw new NotFoundException("Session d'avis non trouvee");
    }

    const now = new Date();

    if (now > session.expiresAt) {
      throw new BadRequestException(
        'La fenetre de soumission de 48h est expirée',
      );
    }

    if (session.revealedAt !== null) {
      throw new BadRequestException('Les avis ont déjà été révélés');
    }

    const isClient = booking.clientId === command.reviewerId;
    const isProfessional = booking.professional.userId === command.reviewerId;

    if (!isClient && !isProfessional) {
      throw new BadRequestException(
        'Vous nêtes pas concerné par cette réservation',
      );
    }

    const reviewerType: ReviewerType = isClient
      ? ReviewerType.CLIENT
      : ReviewerType.PROFESSIONAL;

    const alreadySubmitted = session.reviews.some(
      (r) => r.reviewerType === reviewerType && r.deletedAt === null,
    );

    if (alreadySubmitted) {
      throw new BadRequestException('Vous avez déjà soumis un avis');
    }

    const revieweeId = isClient
      ? booking.professional.userId
      : booking.clientId;

    const editableUntil = new Date(
      now.getTime() + EDIT_WINDOW_MINUTES * 60 * 1000,
    );

    const review = await this.prisma.review.create({
      data: {
        sessionId: session.id,
        bookingId: booking.id,
        reviewerType,
        reviewerId: command.reviewerId,
        revieweeId,
        professionalId: booking.professionalId,
        rating: command.rating,
        comment: command.comment,
        editableUntil,
        isEdited: false,
        isVisible: false,
      },
    });

    const allReviews = [...session.reviews, review];
    const bothSubmitted = [
      ReviewerType.CLIENT,
      ReviewerType.PROFESSIONAL,
    ].every((type) =>
      allReviews.some((r) => r.reviewerType === type && r.deletedAt === null),
    );

    if (bothSubmitted) {
      await this.revealSession(session.id, booking.professionalId);
      this.eventBus.publish(
        new ReviewSessionRevealedEvent(session.id, booking.id),
      );
    }

    return { reviewId: review.id };
  }

  private async revealSession(
    sessionId: string,
    professionalId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.review.updateMany({
        where: { sessionId, deletedAt: null },
        data: { isVisible: true },
      });

      await tx.reviewSession.update({
        where: { id: sessionId },
        data: { revealedAt: new Date() },
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
  }
}

export { REVIEW_WINDOW_HOURS };
