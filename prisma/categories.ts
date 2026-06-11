import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

/**
 * Canonical global service-category catalogue (7 buckets).
 *
 * Single source of truth for category display names, consumed by the full DB
 * seed (`prisma/seed.ts`) and the migration script
 * (`scripts/migrate-categories-to-7.ts`). The stable join key is the **slug**
 * (derived from the name): `toSlug` maps "&" → "et", so slugs stay identical
 * across environments even if a display name is edited.
 */
export type DefaultCategory = {
  name: string;
  description: string;
  icon: string;
};

export const SEED_TAG = 'prisma-seed';

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    name: 'Coupe femme',
    description: 'Coupes de cheveux femme, coiffures, tresses et styling',
    icon: '💇‍♀️',
  },
  {
    name: 'Coupe de cheveux homme',
    description: 'Coupes homme, dégradés, barbe et rasage',
    icon: '💇‍♂️',
  },
  {
    name: 'Épilation',
    description: 'Épilation à la cire, au fil et au laser',
    icon: '✨',
  },
  {
    name: 'Ongle',
    description: 'Manucure, pédicure et pose de gel/résine',
    icon: '💅',
  },
  {
    name: 'Visage',
    description: 'Soins du visage, nettoyage, maquillage et sourcils',
    icon: '💄',
  },
  {
    name: 'Massage',
    description: 'Massages détente, thérapie et bien-être',
    icon: '🧖',
  },
  {
    name: 'Corps',
    description: 'Soins du corps, gommages et enveloppements',
    icon: '🛁',
  },
];

export function toSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/**
 * Upsert the canonical categories into the given database, keyed by slug (with a
 * name fallback for legacy rows). Idempotent and re-runnable on any environment.
 *
 * @returns map of canonical name -> category id
 */
export async function syncCategories(
  prisma: PrismaClient,
): Promise<Map<string, string>> {
  const categoryMap = new Map<string, string>(); // name -> id

  for (const cat of DEFAULT_CATEGORIES) {
    const slug = toSlug(cat.name);
    const existing = await prisma.serviceCategory.findFirst({
      where: {
        OR: [{ slug }, { name: { equals: cat.name, mode: 'insensitive' } }],
      },
      select: { id: true, name: true },
    });

    if (existing) {
      await prisma.serviceCategory.update({
        where: { id: existing.id },
        data: {
          name: cat.name,
          slug,
          description: cat.description,
          icon: cat.icon,
          isActive: true,
          deletedAt: null,
          metadata: { seededBy: SEED_TAG },
        },
      });
      categoryMap.set(cat.name, existing.id);
    } else {
      const created = await prisma.serviceCategory.create({
        data: {
          id: randomUUID(),
          name: cat.name,
          slug,
          description: cat.description,
          icon: cat.icon,
          isActive: true,
          metadata: { seededBy: SEED_TAG },
        },
      });
      categoryMap.set(cat.name, created.id);
    }
  }

  return categoryMap;
}
