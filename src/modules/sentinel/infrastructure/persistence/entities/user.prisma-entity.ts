import { Prisma } from '@prisma/client';

export type UserPrismaEntity = Prisma.UserGetPayload<{
  include: {
    phone: true;
  };
}>;
