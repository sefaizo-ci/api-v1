import { Injectable, Logger } from '@nestjs/common';
import { BadRequestException } from '../../../libs/exceptions/domain.exceptions';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PrismaService } from '../../../libs/database/prisma.service';

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);
  private firebaseApp?: App;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async dispatch(notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!notification || notification.deletedAt) {
      return;
    }

    if (notification.status !== NotificationStatus.PENDING) {
      return;
    }

    try {
      switch (notification.channel) {
        case NotificationChannel.PUSH: {
          await this.sendPush(
            notification.userId,
            notification.title,
            notification.body,
          );
          break;
        }
        case NotificationChannel.WHATSAPP: {
          await this.sendWhatsApp(notification.userId, notification.body);
          break;
        }
        case NotificationChannel.SMS: {
          await this.sendSms(notification.userId, notification.body);
          break;
        }
        default:
          break;
      }

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          failedReason: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.FAILED,
          failedReason: message,
        },
      });

      this.logger.warn(
        `Notification ${notification.id} failed on ${notification.channel}: ${message}`,
      );
    }
  }

  private async sendPush(
    userId: string,
    title: string,
    body: string,
  ): Promise<void> {
    const devices = await this.prisma.notificationDevice.findMany({
      where: {
        userId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        pushToken: true,
        platform: true,
        deviceId: true,
      },
    });

    const tokens = devices.map((item) => item.pushToken).filter(Boolean);

    if (tokens.length === 0) {
      throw new BadRequestException(
        'No active push device token found for this user',
      );
    }

    const dryRun = this.isDryRunEnabled();
    const payload = {
      notification: {
        title,
        body,
      },
      data: {
        channel: 'PUSH',
        userId,
      },
      tokens,
    };

    if (dryRun) {
      this.logger.log(
        `[PUSH][DRY_RUN] user=${userId} tokens=${tokens.length} payload=${JSON.stringify(payload)}`,
      );
      return;
    }

    const app = this.getFirebaseApp();
    const response = await getMessaging(app).sendEachForMulticast(payload);

    this.logger.log(
      `[PUSH][LIVE] user=${userId} success=${response.successCount} failure=${response.failureCount}`,
    );

    if (response.failureCount > 0) {
      const errors = response.responses
        .map((item) => item.error?.message)
        .filter((item): item is string => Boolean(item));

      if (errors.length > 0) {
        this.logger.warn(
          `[PUSH][LIVE] user=${userId} providerErrors=${JSON.stringify(errors)}`,
        );
      }
    }
  }

  private async sendWhatsApp(userId: string, body: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: {
        phone: {
          select: {
            number: true,
          },
        },
      },
    });

    const recipient = this.toE164(user?.phone?.number);
    if (!recipient) {
      throw new BadRequestException(
        'User phone number is missing for WhatsApp delivery',
      );
    }

    const apiVersion =
      this.configService.get<string>('META_WHATSAPP_API_VERSION') ?? 'v20.0';
    const phoneNumberId =
      this.configService.get<string>('META_WHATSAPP_PHONE_NUMBER_ID') ??
      'fake-phone-number-id';
    const token =
      this.configService.get<string>('META_WHATSAPP_ACCESS_TOKEN') ??
      'fake-meta-access-token';

    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'text',
      text: {
        body,
      },
    };

    const dryRun = this.isDryRunEnabled() || this.isFakeValue(token);
    if (dryRun) {
      this.logger.log(
        `[WHATSAPP][DRY_RUN] user=${userId} to=${recipient} endpoint=${url} payload=${JSON.stringify(payload)}`,
      );
      return;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new BadRequestException(
        `Meta WhatsApp failed with status=${response.status} body=${raw}`,
      );
    }

    this.logger.log(
      `[WHATSAPP][LIVE] user=${userId} to=${recipient} status=${response.status} response=${raw}`,
    );
  }

  private async sendSms(userId: string, body: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: {
        phone: {
          select: {
            number: true,
          },
        },
      },
    });

    const recipient = this.toE164(user?.phone?.number);
    if (!recipient) {
      throw new BadRequestException(
        'User phone number is missing for SMS delivery',
      );
    }

    const baseUrl =
      this.configService.get<string>('MTARGET_SMS_BASE_URL') ??
      'https://api.mtarget.local/sms/send';
    const apiKey =
      this.configService.get<string>('MTARGET_SMS_API_KEY') ??
      'fake-mtarget-api-key';
    const sender =
      this.configService.get<string>('MTARGET_SMS_SENDER') ?? 'SEFAIZO';

    const payload = {
      to: recipient,
      message: body,
      sender,
    };

    const dryRun = this.isDryRunEnabled() || this.isFakeValue(apiKey);
    if (dryRun) {
      this.logger.log(
        `[SMS][DRY_RUN] user=${userId} to=${recipient} endpoint=${baseUrl} payload=${JSON.stringify(payload)}`,
      );
      return;
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new BadRequestException(
        `MTarget SMS failed with status=${response.status} body=${raw}`,
      );
    }

    this.logger.log(
      `[SMS][LIVE] user=${userId} to=${recipient} status=${response.status} response=${raw}`,
    );
  }

  private getFirebaseApp(): App {
    if (this.firebaseApp) {
      return this.firebaseApp;
    }

    if (getApps().length > 0) {
      this.firebaseApp = getApps()[0];
      return this.firebaseApp;
    }

    const projectId =
      this.configService.get<string>('FIREBASE_PROJECT_ID') ?? 'fake-project';
    const clientEmail =
      this.configService.get<string>('FIREBASE_CLIENT_EMAIL') ??
      'fake-firebase-admin@fake-project.iam.gserviceaccount.com';
    const privateKeyRaw =
      this.configService.get<string>('FIREBASE_PRIVATE_KEY') ??
      '-----BEGIN PRIVATE KEY-----\\nFAKE_KEY\\n-----END PRIVATE KEY-----\\n';

    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    if (this.isDryRunEnabled() || this.isFakeValue(privateKeyRaw)) {
      this.logger.log(
        `[PUSH][DRY_RUN] Firebase app init skipped with fake/local credentials projectId=${projectId}`,
      );
      this.firebaseApp = initializeApp({
        projectId,
      });
      return this.firebaseApp;
    }

    this.firebaseApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    return this.firebaseApp;
  }

  private isDryRunEnabled(): boolean {
    const value = this.configService.get<string>('NOTIFICATIONS_DRY_RUN');
    if (!value) {
      return true;
    }

    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  private isFakeValue(value?: string): boolean {
    if (!value) {
      return true;
    }

    return value.toLowerCase().includes('fake');
  }

  private toE164(phone?: string): string | null {
    if (!phone) {
      return null;
    }

    const normalized = phone.trim();
    if (normalized.length === 0) {
      return null;
    }

    if (normalized.startsWith('+')) {
      return normalized;
    }

    return `+${normalized.replace(/\s+/g, '')}`;
  }
}
