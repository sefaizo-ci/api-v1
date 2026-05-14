import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProfessionalEntity } from './core/entities/professional.entity';
import { ProfessionalRepository } from './infrastructure/persistence/professional.repository';

@Injectable()
export class ProfessionalSchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProfessionalSchedulerService.name);

  constructor(private readonly repository: ProfessionalRepository) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.reactivateExpiredBookingPauses();
  }

  /**
   * Every 5 minutes: reactivate bookings for professionals whose pause period has expired.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async reactivateExpiredBookingPauses(): Promise<void> {
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
    const professionals: ProfessionalEntity[] =
      await this.repository.findWithExpiredBookingPause();
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */

    if (professionals.length === 0) return;

    this.logger.log(
      `Réactivation des réservations pour ${professionals.length} professionnel(s)`,
    );

    await Promise.all(
      professionals.map((pro: ProfessionalEntity) => {
        pro.resumeBookings();
        return this.repository.save(pro);
      }),
    );
  }
}
