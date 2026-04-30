import type { Prisma } from '@prisma/client';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function withAuthFlowMetadata(
  existing: Prisma.JsonValue,
  patch: Prisma.InputJsonObject,
): Prisma.InputJsonValue {
  const current = isPlainObject(existing)
    ? (existing as Prisma.InputJsonObject)
    : {};

  const currentAuthFlow = isPlainObject(current.authFlow)
    ? (current.authFlow as Prisma.InputJsonObject)
    : {};

  return {
    ...current,
    authFlow: {
      ...currentAuthFlow,
      ...patch,
      updatedAt: new Date().toISOString(),
    },
  };
}
