import { Injectable, Logger } from '@nestjs/common';
import { OtpChannel } from '../core/enums/auth.enums';
import { INotificationService } from '../core/services/notification.service.interface';

@Injectable()
export class NotificationService implements INotificationService {
  private readonly logger = new Logger(NotificationService.name);

  sendOtp(phone: string, code: string): Promise<OtpChannel> {
    try {
      this.sendWhatsApp(phone, code);
      return Promise.resolve(OtpChannel.WHATSAPP);
    } catch {
      this.sendSms(phone, code);
      return Promise.resolve(OtpChannel.SMS);
    }
  }

  private sendWhatsApp(phone: string, code: string): void {
    this.logger.log(`[WHATSAPP] → ${phone} : code ${code}`);
  }

  private sendSms(phone: string, code: string): void {
    this.logger.log(`[SMS] → ${phone} : code ${code}`);
  }
}
