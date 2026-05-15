import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../libs/database/prisma.service';
import { EditReviewCommand } from '../commands';

@CommandHandler(EditReviewCommand)
@Injectable()
export class EditReviewHandler implements ICommandHandler<EditReviewCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: EditReviewCommand): Promise<void> {
    const review = await this.prisma.review.findFirst({
      where: { id: command.reviewId, deletedAt: null },
      include: { session: true },
    });

    if (!review) throw new NotFoundException('Avis non trouvé');

    if (review.reviewerId !== command.reviewerId) {
      throw new ForbiddenException('Vous ne pouvez modifier que vos propres avis');
    }

    if (review.isEdited) {
      throw new BadRequestException(
        'Un avis ne peut être modifié qu\'une seule fois',
      );
    }

    const now = new Date();

    if (now > review.editableUntil) {
      throw new BadRequestException(
        'La fenêtre de modification de 30 minutes est expirée',
      );
    }

    if (review.isVisible || review.session.revealedAt !== null) {
      throw new BadRequestException(
        'Les avis ont été révélés, toute modification est verrouillée',
      );
    }

    await this.prisma.review.update({
      where: { id: review.id },
      data: {
        rating: command.rating,
        comment: command.comment,
        isEdited: true,
      },
    });
  }
}
