import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ReviewerType } from '@prisma/client';
import { PrismaService } from '../../../../libs/database/prisma.service';
import {
  GetClientReviewsQuery,
  GetMyReviewSessionsQuery,
  GetProfessionalReviewsQuery,
} from '../queries';

function maskName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName.charAt(0)}.`;
}

@QueryHandler(GetProfessionalReviewsQuery)
@Injectable()
export class GetProfessionalReviewsHandler
  implements IQueryHandler<GetProfessionalReviewsQuery>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetProfessionalReviewsQuery) {
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: {
          professionalId: query.professionalId,
          reviewerType: ReviewerType.CLIENT,
          isVisible: true,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          rating: true,
          comment: true,
          isEdited: true,
          createdAt: true,
          bookingId: true,
          reviewerId: true,
        },
      }),
      this.prisma.review.count({
        where: {
          professionalId: query.professionalId,
          reviewerType: ReviewerType.CLIENT,
          isVisible: true,
          deletedAt: null,
        },
      }),
    ]);

    const reviewerIds = [...new Set(reviews.map((r) => r.reviewerId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: reviewerIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const professional = await this.prisma.professional.findUnique({
      where: { id: query.professionalId },
      select: { rating: true, reviewCount: true },
    });

    if (!professional) throw new NotFoundException('Professionnel non trouvé');

    return {
      data: reviews.map((r) => {
        const user = userMap.get(r.reviewerId);
        return {
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          isEdited: r.isEdited,
          createdAt: r.createdAt,
          bookingId: r.bookingId,
          reviewerName: user ? maskName(user.firstName, user.lastName) : 'Anonyme',
        };
      }),
      summary: {
        rating: professional.rating,
        reviewCount: professional.reviewCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

@QueryHandler(GetClientReviewsQuery)
@Injectable()
export class GetClientReviewsHandler
  implements IQueryHandler<GetClientReviewsQuery>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetClientReviewsQuery) {
    const professional = await this.prisma.professional.findFirst({
      where: { userId: query.requestingProfessionalId, deletedAt: null },
      select: { id: true },
    });

    if (!professional) throw new NotFoundException('Professionnel non trouvé');

    const hasActiveBooking = await this.prisma.booking.findFirst({
      where: {
        clientId: query.clientId,
        professionalId: professional.id,
        status: { in: ['PENDING', 'CONFIRMED'] },
        deletedAt: null,
      },
    });

    if (!hasActiveBooking) {
      throw new ForbiddenException(
        'Vous devez avoir un booking actif avec ce client pour voir ses avis',
      );
    }

    const client = await this.prisma.user.findFirst({
      where: { id: query.clientId },
      select: { firstName: true, lastName: true, metadata: true },
    });

    if (!client) throw new NotFoundException('Client non trouvé');

    const reviews = await this.prisma.review.findMany({
      where: {
        revieweeId: query.clientId,
        reviewerType: ReviewerType.PROFESSIONAL,
        isVisible: true,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        rating: true,
        comment: true,
        isEdited: true,
        createdAt: true,
        bookingId: true,
      },
    });

    const cancellationCount = await this.prisma.cancellationEvent.count({
      where: {
        clientId: query.clientId,
        initiatedBy: 'CLIENT',
      },
    });

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null;

    return {
      client: {
        firstName: client.firstName,
        lastName: client.lastName,
        cancellationCount,
      },
      summary: {
        rating: avgRating,
        reviewCount: reviews.length,
      },
      data: reviews,
    };
  }
}

@QueryHandler(GetMyReviewSessionsQuery)
@Injectable()
export class GetMyReviewSessionsHandler
  implements IQueryHandler<GetMyReviewSessionsQuery>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetMyReviewSessionsQuery) {
    const now = new Date();

    const professional = await this.prisma.professional.findFirst({
      where: { userId: query.userId, deletedAt: null },
      select: { id: true },
    });

    const bookingWhere = professional
      ? {
          OR: [
            { clientId: query.userId },
            { professionalId: professional.id },
          ],
        }
      : { clientId: query.userId };

    const sessions = await this.prisma.reviewSession.findMany({
      where: {
        expiresAt: { gt: now },
        revealedAt: null,
        booking: { ...bookingWhere, deletedAt: null },
      },
      include: {
        reviews: {
          where: { deletedAt: null },
          select: { reviewerType: true, reviewerId: true },
        },
        booking: {
          select: {
            id: true,
            scheduledAt: true,
            professionalId: true,
            clientId: true,
            service: { select: { name: true } },
            professional: { select: { agencyName: true } },
          },
        },
      },
    });

    return sessions.map((session) => {
      const isClient = session.booking.clientId === query.userId;
      const myType = isClient ? ReviewerType.CLIENT : ReviewerType.PROFESSIONAL;
      const hasSubmitted = session.reviews.some(
        (r) => r.reviewerType === myType && r.reviewerId === query.userId,
      );

      return {
        sessionId: session.id,
        bookingId: session.booking.id,
        serviceName: session.booking.service.name,
        agencyName: session.booking.professional.agencyName,
        scheduledAt: session.booking.scheduledAt,
        expiresAt: session.expiresAt,
        hasSubmitted,
        partnerSubmitted: session.reviews.some(
          (r) => r.reviewerType !== myType,
        ),
      };
    });
  }
}
