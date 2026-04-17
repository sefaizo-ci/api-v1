import { OtpChannel } from '../enums/auth.enums';

export { OtpChannel as NotificationChannel };

export interface INotificationService {
  sendOtp(phone: string, code: string): Promise<OtpChannel>;
}
