import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

type DefaultCategory = {
  name: string;
  description: string;
};

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required for seeding.');
}

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    name: 'Coiffure & soins capillaires',
    description:
      'Tout ce qui touche aux cheveux naturels, defrises ou en transition : coupes, mises en plis, lissages, colorations, soins keratine, shampoings traitants et massages capillaires. Categorie reine sur le marche ivoirien, portee par une culture du soin capillaire profondement ancree.',
  },
  {
    name: 'Tresses & coiffures africaines',
    description:
      'Box braids, tresses collees, cornrows, vanilles, goddess braids, twists et toutes les techniques de tressage africain. Categorie a part entiere qui requiert un savoir-faire specifique, des durees longues (3 a 8 heures) et genere une clientele tres fidele.',
  },
  {
    name: 'Locks & dreadlocks',
    description:
      'Pose, entretien, retamage et soins des locks, sisterlocks et dreadlocks. Technique de niche avec une communaute dediee qui cherche des professionnels specialises.',
  },
  {
    name: 'Extensions & pose de perruques',
    description:
      "Pose de tissages, wigs, extensions a la colle, a l'aiguille ou au clip. Perruques full lace, lace front, U-part. Categorie en forte croissance portee par les tendances des reseaux sociaux.",
  },
  {
    name: 'Manucure & ongles',
    description:
      "Manucure classique, pose de gel, resine, polygel, nail art, extensions d'ongles, french, baby boomer et soins des cuticules. L'une des categories les plus demandees a domicile.",
  },
  {
    name: 'Pedicure & soins des pieds',
    description:
      'Pedicure esthetique et medicale, pose de vernis semi-permanent, soins des callosites et gommages. Souvent proposee en duo avec la manucure dans une session complete.',
  },
  {
    name: 'Maquillage',
    description:
      'Maquillage du quotidien, de soiree, de mariee et pour evenements - baptemes, remises de diplomes, shootings photo. Tres actif sur le marche ivoirien, porte par la culture des ceremonies.',
  },
  {
    name: 'Epilation',
    description:
      'Epilation a la cire chaude, froide ou orientale, au fil, a la creme ou au laser. Jambes, aisselles, maillot, visage. Prestation reguliere qui genere une clientele tres fidele.',
  },
  {
    name: 'Soins du visage & esthetique',
    description:
      'Nettoyage de peau, hydratation, peeling, gommage, soin anti-age, drainage facial et masques. En forte croissance a Abidjan avec la democratisation de la routine skincare.',
  },
  {
    name: 'Massage & relaxation',
    description:
      "Massage suedois, californien, sportif, aux pierres chaudes, drainage lymphatique et reflexologie plantaire. Ideal a domicile, segment en forte croissance dans les classes moyennes et superieures d'Abidjan.",
  },
  {
    name: 'Extensions de cils',
    description:
      'Pose de cils en volume russe, naturel, classique, mega volume et retouches. Tres populaire sur les reseaux sociaux avec une clientele jeune et urbaine tres active.',
  },
  {
    name: 'Sourcils & microblading',
    description:
      'Design et mise en forme, epilation au fil, microblading, microshading, poudre et lamine de sourcils. Prestation courte a forte valeur ajoutee.',
  },
  {
    name: 'Soins du corps & enveloppements',
    description:
      'Gommages corporels, enveloppements au karite, argile ou algues, soins amincissants et raffermissants. Le karite, embleme de la cosmetique ouest-africaine, resonne particulierement avec le marche local.',
  },
  {
    name: 'Barbier & soins homme',
    description:
      'Coupe homme, degrade, rasage au couteau, taille de barbe, soin du cuir chevelu. Marche important a Abidjan avec une culture du barbier tres vivante dans tous les quartiers.',
  },
  {
    name: 'Henne & tatouage temporaire',
    description:
      "Henne naturel et noir pour les mains, pieds et corps. Tres demande pour les mariages et ceremonies. Culturellement fort en Cote d'Ivoire, particulierement dans les communautes musulmanes.",
  },
  {
    name: 'Bien-etre & therapies douces',
    description:
      'Yoga, meditation guidee, sophrologie, sonotherapie et seances de respiration. Segment premium emergent a Abidjan, principalement dans les quartiers residentiels de Cocody, Riviera et Angre.',
  },
  {
    name: 'Maquillage permanent & semi-permanent',
    description:
      "Tatouage cosmetique des levres, des sourcils et du contour des yeux. Prestation hautement specialisee a prix eleve, destinee a une clientele a fort pouvoir d'achat.",
  },
  {
    name: 'Coloration & balayage',
    description:
      'Coloration complete, meches, balayage, ombre hair, tie and dye, decoloration et neutralisation. Categorie distincte de la coiffure classique car elle exige une formation chimique specifique et un materiel dedie.',
  },
  {
    name: 'Soins capillaires specialises',
    description:
      'Traitements en profondeur pour cheveux abimes - botox capillaire, proteines, lissage bresilien, soins a la vapeur, hydratation intense et reequilibrage du cuir chevelu. Distinct de la coiffure quotidienne, ce segment cible les clientes en quete de resultats therapeutiques.',
  },
  {
    name: 'Coiffure & beaute mariage',
    description:
      "Offre packagee dediee aux mariees et a leur entourage : essais coiffure, maquillage de ceremonie, coiffure des demoiselles d'honneur, equipe mobile le jour J. Categorie evenementielle a forte valeur ajoutee, tres active dans le contexte des grands mariages ivoiriens.",
  },
  {
    name: 'Spa & soins premium',
    description:
      'Journees spa, rituels corps complets, soins en duo, hammam, bain de vapeur et experiences de detente multi-etapes. Souvent propose en formule forfait pour les anniversaires, enterrements de vie de jeune fille et cadeaux.',
  },
  {
    name: 'Medecine esthetique & injections',
    description:
      'Injections de botox, acide hyaluronique, mesotherapie, PRP capillaire et soins medicaux esthetiques. Reserve aux professionnels certifies. Categorie en forte emergence dans les grandes metropoles africaines dont Abidjan.',
  },
  {
    name: 'Tatouage & piercing',
    description:
      'Tatouages artistiques temporaires ou permanents, piercing du corps et des oreilles, retrait de piercing. Marche de niche mais en croissance chez les jeunes adultes urbains.',
  },
  {
    name: 'Soins prenataux & postnatal',
    description:
      "Massage de grossesse, soins du ventre, preparation a l'accouchement par le toucher, massage postnatal et remise en forme douce apres l'accouchement. Categorie tres peu couverte sur le marche ivoirien mais a fort potentiel de demande.",
  },
  {
    name: 'Consultation beaute & coaching',
    description:
      "Diagnostic capillaire, conseil en colorimetrie personnelle, coaching image et relooking, analyse de peau et recommandation de routine. Prestation intellectuelle et conseil plutot que technique, a destination d'une clientele qui veut comprendre et se prendre en main.",
  },
  {
    name: 'Coiffure & soins enfants',
    description:
      'Coupes pour enfants, tresses pour petites filles, premiers soins capillaires, demelages doux et coiffures de ceremonie pour enfants. Segment souvent oublie des plateformes mais tres demande par les parents, particulierement pour les occasions speciales.',
  },
  {
    name: 'Soins des mains & paraffine',
    description:
      'Bains de paraffine, soins hydratants intensifs des mains, gommages et massages des mains et avant-bras. Complement naturel a la manucure, propose en soin additionnel ou en prestation autonome.',
  },
  {
    name: 'Minceur & remodelage corporel',
    description:
      'Cryolipolyse, ultrasons, radiofrequence, palper-rouler, drainage et enveloppements amincissants technologiques. Segment premium reserve aux professionnels equipes, a forte marge.',
  },
  {
    name: 'Formation & masterclass beaute',
    description:
      'Cours et formations professionnelles en tressage, nail art, maquillage, microblading et techniques esthetiques. Permet aux professionnels de SEFAIZO de proposer leur expertise en formation, ouvrant un nouveau canal de revenus sur la plateforme.',
  },
];

function toSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

async function upsertCategory(category: DefaultCategory): Promise<void> {
  const slug = toSlug(category.name);
  const existing = await prisma.serviceCategory.findFirst({
    where: {
      OR: [
        { slug },
        {
          name: {
            equals: category.name,
            mode: 'insensitive',
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    await prisma.serviceCategory.update({
      where: { id: existing.id },
      data: {
        name: category.name,
        slug,
        description: category.description,
        isActive: true,
        deletedAt: null,
        metadata: {
          seededBy: 'prisma-seed',
        },
      },
    });
    return;
  }

  await prisma.serviceCategory.create({
    data: {
      id: randomUUID(),
      name: category.name,
      slug,
      description: category.description,
      isActive: true,
      metadata: {
        seededBy: 'prisma-seed',
      },
    },
  });
}

async function main(): Promise<void> {
  for (const category of DEFAULT_CATEGORIES) {
    await upsertCategory(category);
  }

  console.log(`Seed categories done: ${DEFAULT_CATEGORIES.length}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
