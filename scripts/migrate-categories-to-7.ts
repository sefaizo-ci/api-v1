import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { DEFAULT_CATEGORIES, syncCategories, toSlug } from '../prisma/categories';

/**
 * Collapse the legacy service-category catalogue into the canonical 7
 * (prisma/categories.ts), WITHOUT breaking existing data:
 *   1. upsert the 7 canonical categories (keyed by slug);
 *   2. re-point every ServiceOffering + ServiceCategoryRequest from a legacy
 *      category to its mapped target among the 7;
 *   3. soft-delete the now-unreferenced legacy categories.
 *
 * `ServiceOffering.category` is onDelete: Restrict, so step 2 MUST precede any
 * removal. Idempotent and re-runnable; keyed by slug so it works identically on
 * local and prod.
 *
 * Usage:
 *   DATABASE_URL="postgresql://…" tsx scripts/migrate-categories-to-7.ts
 *   DRY_RUN=true DATABASE_URL="…" tsx scripts/migrate-categories-to-7.ts
 */

// Legacy category slug → canonical target name (one of the 7).
// "Épilation" is omitted on purpose: its slug ("epilation") equals the legacy
// "Epilation" slug, so syncCategories just renames that row in place.
const LEGACY_SLUG_TO_TARGET: Record<string, string> = {
  'coiffure-et-soins-capillaires': 'Coupe femme',
  'tresses-et-coiffures-africaines': 'Coupe femme',
  'locks-et-dreadlocks': 'Coupe femme',
  'extensions-et-pose-de-perruques': 'Coupe femme',
  'coloration-et-balayage': 'Coupe femme',
  'soins-capillaires-specialises': 'Coupe femme',
  'coiffure-et-beaute-mariage': 'Coupe femme',
  'coiffure-et-soins-enfants': 'Coupe femme',
  'barbier-et-soins-homme': 'Coupe de cheveux homme',
  'manucure-et-ongles': 'Ongle',
  'pedicure-et-soins-des-pieds': 'Ongle',
  'soins-des-mains-et-paraffine': 'Ongle',
  'maquillage': 'Visage',
  'maquillage-permanent-et-semi-permanent': 'Visage',
  'soins-du-visage-et-esthetique': 'Visage',
  'sourcils-et-microblading': 'Visage',
  'extensions-de-cils': 'Visage',
  'medecine-esthetique-et-injections': 'Visage',
  'consultation-beaute-et-coaching': 'Visage',
  'massage-et-relaxation': 'Massage',
  'bien-etre-et-therapies-douces': 'Massage',
  'spa-et-soins-premium': 'Massage',
  'soins-du-corps-et-enveloppements': 'Corps',
  'minceur-et-remodelage-corporel': 'Corps',
  'soins-prenataux-et-postnatal': 'Corps',
  'henne-et-tatouage-temporaire': 'Corps',
  'tatouage-et-piercing': 'Corps',
  'formation-et-masterclass-beaute': 'Corps',
};

const FALLBACK_TARGET = 'Corps';
const SEVEN_SLUGS = new Set(DEFAULT_CATEGORIES.map((c) => toSlug(c.name)));
const DRY_RUN = process.env.DRY_RUN === 'true';

async function main(): Promise<void> {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const masked = DATABASE_URL.replace(/:[^@/]*@/, ':****@');
  console.log(`${DRY_RUN ? '🔍 DRY-RUN ' : '🚚 '}Migrating categories → ${masked}`);

  const pool = new Pool({ connectionString: DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    await prisma.$transaction(
      async (tx) => {
      // 1. Ensure the 7 canonical categories exist; capture name → id.
      const targetIdByName = await syncCategories(tx as unknown as PrismaClient);

      // 2. Walk every legacy category still active and not one of the 7.
      const legacy = await tx.serviceCategory.findMany({
        where: { deletedAt: null, slug: { notIn: [...SEVEN_SLUGS] } },
        select: { id: true, name: true, slug: true },
      });

      let svcMoved = 0;
      let reqMoved = 0;
      for (const cat of legacy) {
        const targetName = LEGACY_SLUG_TO_TARGET[cat.slug] ?? FALLBACK_TARGET;
        if (!LEGACY_SLUG_TO_TARGET[cat.slug]) {
          console.warn(`  ⚠ unmapped "${cat.name}" (${cat.slug}) → ${FALLBACK_TARGET}`);
        }
        const targetId = targetIdByName.get(targetName)!;

        const svc = await tx.serviceOffering.updateMany({
          where: { categoryId: cat.id },
          data: { categoryId: targetId },
        });
        const req = await tx.serviceCategoryRequest.updateMany({
          where: { approvedCategoryId: cat.id },
          data: { approvedCategoryId: targetId },
        });
        svcMoved += svc.count;
        reqMoved += req.count;

        await tx.serviceCategory.update({
          where: { id: cat.id },
          data: { isActive: false, deletedAt: new Date() },
        });
        console.log(
          `  • ${cat.name} → ${targetName}  (services:${svc.count} requests:${req.count})`,
        );
      }

      console.log(
        `\n  Legacy categories retired: ${legacy.length} | services moved: ${svcMoved} | requests moved: ${reqMoved}`,
      );

      if (DRY_RUN) {
        throw new Error('__DRY_RUN_ROLLBACK__');
      }
      },
      // Remote (Neon) latency × many sequential statements needs a generous
      // interactive-transaction window; default is only 5s.
      { timeout: 120_000, maxWait: 20_000 },
    );
  } catch (err) {
    if (err instanceof Error && err.message === '__DRY_RUN_ROLLBACK__') {
      console.log('\n🔍 DRY-RUN complete — transaction rolled back, no changes written.');
    } else {
      throw err;
    }
  } finally {
    // Report final active catalogue.
    const active = await prisma.serviceCategory.findMany({
      where: { deletedAt: null },
      select: { name: true, slug: true },
      orderBy: { name: 'asc' },
    });
    console.log(`\n✓ Active categories now (${active.length}):`);
    for (const c of active) console.log(`   - ${c.name}  (${c.slug})`);
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('✖ Migration failed:', err);
  process.exit(1);
});
