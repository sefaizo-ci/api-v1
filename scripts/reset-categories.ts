import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function toSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'et')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

interface CategoryData {
  name: string;
  description: string;
  icon: string;
  color: string;
}

const NEW_CATEGORIES: CategoryData[] = [
  {
    name: 'Coupe femme',
    description: 'Coupes de cheveux femme, coiffures et styling',
    icon: '💇‍♀️',
    color: '#E75480',
  },
  {
    name: 'Coupe de cheveux homme',
    description: 'Coupes homme, dégradés et rasage',
    icon: '💇‍♂️',
    color: '#3498DB',
  },
  {
    name: 'Épilation',
    description: 'Épilation à la cire, au fil et au laser',
    icon: '✨',
    color: '#E75480',
  },
  {
    name: 'Ongle',
    description: 'Manucure, pédicure et pose de gel/résine',
    icon: '💅',
    color: '#EC407A',
  },
  {
    name: 'Visage',
    description: 'Soins du visage, nettoyage et maquillage',
    icon: '💄',
    color: '#F4A460',
  },
  {
    name: 'Massage',
    description: 'Massages détente, thérapie et bien-être',
    icon: '🧖',
    color: '#9B59B6',
  },
  {
    name: 'Corps',
    description: 'Soins du corps, gommages et enveloppements',
    icon: '🛁',
    color: '#1ABC9C',
  },
];

async function main() {
  try {
    console.log('🧹 Suppression complète des catégories existantes...');

    // Hard delete all existing categories
    const deleted = await prisma.serviceCategory.deleteMany({});
    console.log(`✅ ${deleted.count} catégories supprimées`);

    console.log('🎨 Création des 7 nouvelles catégories...');

    for (const cat of NEW_CATEGORIES) {
      const slug = toSlug(cat.name);

      await prisma.serviceCategory.create({
        data: {
          name: cat.name,
          slug,
          description: cat.description,
          icon: cat.icon,
          isActive: true,
          metadata: {
            color: cat.color,
            seededBy: 'reset-categories',
          },
        },
      });
      console.log(`➕ ${cat.icon} ${cat.name}`);
    }

    const final = await prisma.serviceCategory.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    console.log('\n✨ Catégories actuelles:');
    final.forEach((cat) => {
      const metadata = cat.metadata as any;
      console.log(`  ${cat.icon} ${cat.name} (${metadata?.color || 'N/A'})`);
    });

    console.log(`\n✅ Seeding terminé! ${final.length} catégories actives.`);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
