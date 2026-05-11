import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../libs/database/prisma.service';
import { RegisterPushTokenCommand } from '../commands/register-push-token.command';

@CommandHandler(RegisterPushTokenCommand)
export class RegisterPushTokenHandler implements ICommandHandler<RegisterPushTokenCommand> {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async execute(cmd: RegisterPushTokenCommand): Promise<{ message: string }> {
    await this.prisma.notificationDevice.upsert({
      where: {
        userId_platform_deviceId: {
          userId: cmd.userId,
          platform: cmd.platform,
          deviceId: cmd.deviceId,
        },
      },
      update: {
        pushToken: cmd.pushToken,
        isActive: true,
        lastSeenAt: new Date(),
      },
      create: {
        userId: cmd.userId,
        platform: cmd.platform,
        deviceId: cmd.deviceId,
        pushToken: cmd.pushToken,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });

    return { message: 'Token push enregistré.' };
  }
}
