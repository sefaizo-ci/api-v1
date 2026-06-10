import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProfessionalEntity } from './core/entities/professional.entity';
import { ProfessionalRepository } from './infrastructure/persistence/professional.repository';
import {
  ProfessionalRejectedEvent,
  ProfessionalVerifiedEvent,
} from './interface/events/profile.events';

const AUTO_REJECTION_GRACE_HOURS = 72;

function buildAutoRejectionReason(pro: ProfessionalEntity): string {
  const missing: string[] = [];
  if (!pro.agencyName?.trim()) missing.push('nom du salon');
  if (!pro.avatarUrl) missing.push('photo de profil');
  if (!pro.bio?.trim()) missing.push('description');
  if (!pro.mainCategories?.length) missing.push('catégorie principale');
  if (!pro.hasServices()) missing.push('service actif');
  return `Profil incomplet après ${AUTO_REJECTION_GRACE_HOURS}h. Éléments manquants : ${missing.join(', ')}.`;
}

@Injectable()
export class ProfessionalSchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProfessionalSchedulerService.name);

  constructor(
    private readonly repository: ProfessionalRepository,
    private readonly eventBus: EventBus,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.reactivateExpiredBookingPauses();
    await this.autoVerifyEligibleProfessionals();
    await this.autoRejectIncompleteProfessionals();
  }

  /**
   * Every 10 minutes: auto-verify professionals who completed their onboarding
   * (PENDING + photo + at least 1 active service + at least 1 active availability).
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoVerifyEligibleProfessionals(): Promise<void> {
    const professionals =
      await this.repository.findEligibleForAutoVerification();

    if (professionals.length === 0) return;

    await Promise.all(
      professionals.map(async (pro: ProfessionalEntity) => {
        pro.verify();
        await this.repository.save(pro);
        this.eventBus.publish(new ProfessionalVerifiedEvent(pro.id));
      }),
    );
  }

  /**
   * Every hour: auto-reject professionals who have been PENDING for more than 72h
   * without completing their required profile (photo, service, availability).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async autoRejectIncompleteProfessionals(): Promise<void> {
    const professionals = await this.repository.findIncompleteAfterGracePeriod(
      AUTO_REJECTION_GRACE_HOURS,
    );

    if (professionals.length === 0) return;

    await Promise.all(
      professionals.map(async (pro: ProfessionalEntity) => {
        const reason = buildAutoRejectionReason(pro);
        pro.reject(reason);
        await this.repository.save(pro);
        this.eventBus.publish(new ProfessionalRejectedEvent(pro.id, reason));
      }),
    );
  }

  /**
   * Every 5 minutes: reactivate bookings for professionals whose pause period has expired.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async reactivateExpiredBookingPauses(): Promise<void> {
    const professionals: ProfessionalEntity[] =
      await this.repository.findWithExpiredBookingPause();

    if (professionals.length === 0) return;

    await Promise.all(
      professionals.map((pro: ProfessionalEntity) => {
        pro.resumeBookings();
        return this.repository.save(pro);
      }),
    );
  }
}
