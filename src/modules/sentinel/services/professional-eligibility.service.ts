import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../libs/database/prisma.service';

@Injectable()
export class ProfessionalEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async refresh(userId: string): Promise<void> {
    const data = await this.prisma.user.findFirst({
      where: { id: userId },
      select: {
        firstName: true,
        professional: {
          where: { deletedAt: null },
          select: {
            id: true,
            agencyName: true,
            avatarUrl: true,
            bio: true,
            address: true,
            location: true,
            mainCategories: true,
            bookingsPausedUntil: true,
            services: {
              where: { isActive: true, deletedAt: null },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    const pro = data?.professional;
    if (!pro) return;

    const localisationRequired = pro.location === 'SALON';

    const eligible =
      !!(data?.firstName?.trim()) &&
      !!(pro.mainCategories?.length) &&
      !!(pro.agencyName?.trim() && pro.avatarUrl && pro.bio?.trim()) &&
      !!(pro.services?.length) &&
      (!localisationRequired || !!(pro.address));

    // Respect a manual booking pause — only restore isAcceptingBookings if the pro
    // hasn't explicitly paused (bookingsPausedUntil null or already expired)
    const manuallyPaused =
      pro.bookingsPausedUntil !== null && pro.bookingsPausedUntil > new Date();

    await this.prisma.professional.update({
      where: { id: pro.id },
      data: {
        isListingActive: eligible,
        isAcceptingBookings: eligible && !manuallyPaused,
      },
    });
  }
}
