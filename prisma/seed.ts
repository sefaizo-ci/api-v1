import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { DEFAULT_CATEGORIES, SEED_TAG, syncCategories } from './categories';

// ─── DB Setup ────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required for seeding.');

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Constants ───────────────────────────────────────────────────────────────

const TEST_PIN = '2025'; // PIN de test pour tous les comptes seed

// ─── Categories ───────────────────────────────────────────────────────────────

async function seedCategories(): Promise<Map<string, string>> {
  // Canonical catalogue lives in ./categories (shared with scripts/sync-categories.ts).
  const categoryMap = await syncCategories(prisma);
  console.log(`✓ Categories: ${DEFAULT_CATEGORIES.length}`);
  return categoryMap;
}

// ─── Users ────────────────────────────────────────────────────────────────────

type SeedUser = {
  phone: string;
  firstName: string;
  lastName: string;
  role: 'CLIENT' | 'PROFESSIONAL';
};

const SEED_CLIENTS: SeedUser[] = [
  { phone: '+2250701234501', firstName: 'Marie', lastName: 'Kouamé', role: 'CLIENT' },
  { phone: '+2250701234502', firstName: 'Jean-Baptiste', lastName: 'Kofi', role: 'CLIENT' },
  { phone: '+2250701234503', firstName: 'Sarah', lastName: 'Gnéré', role: 'CLIENT' },
  { phone: '+2250701234504', firstName: 'David', lastName: 'Ségbé', role: 'CLIENT' },
  { phone: '+2250701234505', firstName: 'Fatou', lastName: 'Diomandé', role: 'CLIENT' },
];

const SEED_PROS: SeedUser[] = [
  { phone: '+2250701234510', firstName: 'Awa', lastName: 'Coulibaly', role: 'PROFESSIONAL' },
  { phone: '+2250701234511', firstName: 'Fatoumata', lastName: 'Diallo', role: 'PROFESSIONAL' },
  { phone: '+2250701234512', firstName: 'Aminata', lastName: 'Traoré', role: 'PROFESSIONAL' },
  { phone: '+2250701234513', firstName: 'Ibrahim', lastName: 'Koné', role: 'PROFESSIONAL' },
  { phone: '+2250701234514', firstName: 'Mariam', lastName: 'Ouattara', role: 'PROFESSIONAL' },
  { phone: '+2250701234515', firstName: 'Kadidia', lastName: 'Bamba', role: 'PROFESSIONAL' },
];

async function seedUser(u: SeedUser, pinHash: string): Promise<string> {
  const existing = await prisma.phoneNumber.findUnique({ where: { number: u.phone } });

  let phoneId: string;
  let userId: string;

  if (existing) {
    phoneId = existing.id;
    const user = await prisma.user.findFirst({ where: { phoneId }, select: { id: true } });
    if (user) return user.id;
  }

  phoneId = existing?.id ?? randomUUID();

  if (!existing) {
    await prisma.phoneNumber.create({
      data: { id: phoneId, number: u.phone, isVerified: true, metadata: { seededBy: SEED_TAG } },
    });
  }

  userId = randomUUID();
  await prisma.user.create({
    data: {
      id: userId,
      phoneId,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role as any,
      isVerified: true,
      isActive: true,
      metadata: {
        seededBy: SEED_TAG,
        profileCompleted: true,
        registrationCompleted: true,
      },
    },
  });

  await prisma.phoneNumber.update({
    where: { id: phoneId },
    data: u.role === 'PROFESSIONAL'
      ? { professionalUserId: userId }
      : { clientUserId: userId },
  });

  // PIN stored in ClientSecret (same table as mobile app key, clientId = userId)
  const existingSecret = await prisma.clientSecret.findUnique({ where: { clientId: userId } });
  if (!existingSecret) {
    await prisma.clientSecret.create({
      data: {
        id: randomUUID(),
        clientId: userId,
        secretHash: pinHash,
        appPlatform: 'MOBILE',
        isActive: true,
        metadata: { seededBy: SEED_TAG },
      },
    });
  }

  return userId;
}

async function seedUsers(pinHash: string): Promise<{ clients: string[]; pros: string[] }> {
  const clients: string[] = [];
  for (const u of SEED_CLIENTS) {
    clients.push(await seedUser(u, pinHash));
  }

  const pros: string[] = [];
  for (const u of SEED_PROS) {
    pros.push(await seedUser(u, pinHash));
  }

  console.log(`✓ Clients: ${clients.length} | Pros: ${pros.length}`);
  return { clients, pros };
}

// ─── Professional profiles ────────────────────────────────────────────────────

type ProProfile = {
  agencyName: string;
  bio: string;
  avatarUrl: string;
  location: 'HOME' | 'SALON' | 'BOTH';
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
};

const PRO_PROFILES: ProProfile[] = [
  {
    agencyName: 'Studio Awa Hair',
    bio: "Spécialiste en coiffure naturelle et soins capillaires depuis 8 ans. Je me déplace à domicile dans tout Abidjan pour vous offrir un service premium. Mes techniques respectent l'intégrité de votre cheveu.",
    avatarUrl: 'https://i.pravatar.cc/300?img=5',
    location: 'BOTH',
    address: 'Cocody Riviera 3, Abidjan',
    latitude: 5.3713,
    longitude: -3.9699,
    rating: 4.8,
    reviewCount: 47,
  },
  {
    agencyName: 'Fatou Braids Palace',
    bio: "Experte en tresses africaines et coiffures protectrices. Box braids, cornrows, knotless braids... Je maîtrise toutes les techniques. Résultat soigné garanti, cheveux protégés et sublimés.",
    avatarUrl: 'https://i.pravatar.cc/300?img=10',
    location: 'HOME',
    address: 'Plateau, Abidjan',
    latitude: 5.3190,
    longitude: -4.0227,
    rating: 4.9,
    reviewCount: 83,
  },
  {
    agencyName: 'Nail Art by Aminata',
    bio: "Prothésiste ongulaire certifiée, je crée des nail arts uniques adaptés à votre personnalité. Gel, résine, polygel — je travaille uniquement avec des produits de qualité professionnelle.",
    avatarUrl: 'https://i.pravatar.cc/300?img=20',
    location: 'BOTH',
    address: 'Marcory Zone 4, Abidjan',
    latitude: 5.2943,
    longitude: -3.9898,
    rating: 4.7,
    reviewCount: 61,
  },
  {
    agencyName: 'Barbershop Ibrahim',
    bio: "Barbier professionnel avec 10 ans d'expérience. Dégradés américains, rasage traditionnel au couteau, taille de barbe — je sublime chaque client avec précision et soin.",
    avatarUrl: 'https://i.pravatar.cc/300?img=50',
    location: 'SALON',
    address: 'Yopougon Niangon, Abidjan',
    latitude: 5.3271,
    longitude: -4.0887,
    rating: 4.6,
    reviewCount: 112,
  },
  {
    agencyName: 'Glam by Mariam',
    bio: "Maquilleuse professionnelle pour tous vos événements : mariages, baptêmes, soirées de gala. Je me déplace avec mon matériel complet pour vous préparer en toute sérénité.",
    avatarUrl: 'https://i.pravatar.cc/300?img=32',
    location: 'HOME',
    address: 'Riviera Golf, Cocody, Abidjan',
    latitude: 5.3667,
    longitude: -3.9500,
    rating: 4.9,
    reviewCount: 38,
  },
  {
    agencyName: 'Lash Studio Kadidia',
    bio: "Technicienne en extensions de cils depuis 5 ans. Volume russe, naturel, mega volume — des cils parfaits adaptés à la forme de vos yeux. Produits hypoallergéniques uniquement.",
    avatarUrl: 'https://i.pravatar.cc/300?img=47',
    location: 'BOTH',
    address: 'Angré 8ème Tranche, Abidjan',
    latitude: 5.3871,
    longitude: -3.9620,
    rating: 4.8,
    reviewCount: 55,
  },
];

async function seedProfessionals(userIds: string[]): Promise<string[]> {
  const proIds: string[] = [];

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    const profile = PRO_PROFILES[i];

    const existing = await prisma.professional.findUnique({ where: { userId } });
    if (existing) {
      proIds.push(existing.id);
      continue;
    }

    const pro = await prisma.professional.create({
      data: {
        id: randomUUID(),
        userId,
        agencyName: profile.agencyName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        location: profile.location as any,
        address: profile.address,
        latitude: profile.latitude,
        longitude: profile.longitude,
        status: 'ACTIVE',
        isVerified: true,
        rating: profile.rating,
        reviewCount: profile.reviewCount,
        metadata: { seededBy: SEED_TAG },
      },
    });

    proIds.push(pro.id);
  }

  console.log(`✓ Profils professionnels: ${proIds.length}`);
  return proIds;
}

// ─── Services ─────────────────────────────────────────────────────────────────

type ServiceDef = {
  name: string;
  description: string;
  categoryName: string;
  durationMin: number;
  basePrice: number;
  communes: { commune: string; travelFee: number }[];
};

const PRO_SERVICES: ServiceDef[][] = [
  // Awa — Coiffure
  [
    {
      name: 'Brushing & mise en plis',
      description: 'Lavage, soin, brushing professionnel et mise en forme. Résultat lisse et brillant durable.',
      categoryName: 'Coupe femme',
      durationMin: 90,
      basePrice: 8000,
      communes: [{ commune: 'Cocody', travelFee: 0 }, { commune: 'Plateau', travelFee: 1500 }, { commune: 'Marcory', travelFee: 2000 }, { commune: 'Yopougon', travelFee: 3000 }],
    },
    {
      name: 'Soin kératine',
      description: 'Lissage brésilien à la kératine. Cheveux lisses, brillants et sans frisottis pendant 3 à 4 mois.',
      categoryName: 'Coupe femme',
      durationMin: 180,
      basePrice: 35000,
      communes: [{ commune: 'Cocody', travelFee: 0 }, { commune: 'Plateau', travelFee: 2000 }, { commune: 'Marcory', travelFee: 2500 }],
    },
    {
      name: 'Coupe + soin + brushing',
      description: 'Forfait complet : coupe personnalisée, soin hydratant et brushing finition.',
      categoryName: 'Coupe femme',
      durationMin: 120,
      basePrice: 15000,
      communes: [{ commune: 'Cocody', travelFee: 0 }, { commune: 'Riviera', travelFee: 500 }, { commune: 'Plateau', travelFee: 2000 }],
    },
  ],
  // Fatoumata — Tresses
  [
    {
      name: 'Box braids medium',
      description: 'Box braids de taille medium, extensions de qualité incluses. Durée de tenue : 4 à 8 semaines.',
      categoryName: 'Coupe femme',
      durationMin: 300,
      basePrice: 25000,
      communes: [{ commune: 'Plateau', travelFee: 0 }, { commune: 'Cocody', travelFee: 1000 }, { commune: 'Marcory', travelFee: 2000 }, { commune: 'Treichville', travelFee: 1500 }],
    },
    {
      name: 'Knotless braids',
      description: 'Tresses sans nœuds, plus légères et plus naturelles. Moins de tension sur le cuir chevelu.',
      categoryName: 'Coupe femme',
      durationMin: 360,
      basePrice: 30000,
      communes: [{ commune: 'Plateau', travelFee: 0 }, { commune: 'Cocody', travelFee: 1000 }, { commune: 'Abobo', travelFee: 3000 }],
    },
    {
      name: 'Cornrows',
      description: 'Tresses plaquées au cuir chevelu, multiples designs possibles. Avec ou sans extensions.',
      categoryName: 'Coupe femme',
      durationMin: 120,
      basePrice: 12000,
      communes: [{ commune: 'Plateau', travelFee: 0 }, { commune: 'Cocody', travelFee: 1000 }, { commune: 'Treichville', travelFee: 1500 }],
    },
  ],
  // Aminata — Ongles
  [
    {
      name: 'Pose gel complète',
      description: 'Pose de gel sur capsules ou ongles naturels. Finition french, couleur unie ou nail art simple inclus.',
      categoryName: 'Ongle',
      durationMin: 90,
      basePrice: 12000,
      communes: [{ commune: 'Marcory', travelFee: 0 }, { commune: 'Treichville', travelFee: 1000 }, { commune: 'Koumassi', travelFee: 1500 }, { commune: 'Plateau', travelFee: 2000 }],
    },
    {
      name: 'Nail art premium',
      description: "Decoration avancee : degrades, motifs floraux, pierres, feuilles d'or. Oeuvre unique sur chaque ongle.",
      categoryName: 'Ongle',
      durationMin: 120,
      basePrice: 18000,
      communes: [{ commune: 'Marcory', travelFee: 0 }, { commune: 'Cocody', travelFee: 2000 }],
    },
    {
      name: 'Manucure + pédicure',
      description: 'Soin complet des mains et des pieds : lime, repousse cuticules, vernis semi-permanent.',
      categoryName: 'Ongle',
      durationMin: 120,
      basePrice: 14000,
      communes: [{ commune: 'Marcory', travelFee: 0 }, { commune: 'Treichville', travelFee: 1000 }, { commune: 'Plateau', travelFee: 2500 }],
    },
  ],
  // Ibrahim — Barbier
  [
    {
      name: 'Dégradé américain',
      description: 'Dégradé précis au clipper, contours nets au razor. Finition avec produits de soin premium.',
      categoryName: 'Coupe de cheveux homme',
      durationMin: 60,
      basePrice: 5000,
      communes: [{ commune: 'Yopougon', travelFee: 0 }, { commune: 'Plateau', travelFee: 2000 }, { commune: 'Abobo', travelFee: 1500 }],
    },
    {
      name: 'Taille de barbe',
      description: 'Taille et mise en forme de la barbe, rasage des contours, huile de soin appliquée en finition.',
      categoryName: 'Coupe de cheveux homme',
      durationMin: 30,
      basePrice: 3000,
      communes: [{ commune: 'Yopougon', travelFee: 0 }, { commune: 'Plateau', travelFee: 2000 }],
    },
    {
      name: 'Forfait complet homme',
      description: 'Coupe + dégradé + barbe + soin du cuir chevelu. Le tout en une session.',
      categoryName: 'Coupe de cheveux homme',
      durationMin: 90,
      basePrice: 10000,
      communes: [{ commune: 'Yopougon', travelFee: 0 }, { commune: 'Plateau', travelFee: 2500 }, { commune: 'Cocody', travelFee: 3000 }],
    },
  ],
  // Mariam — Maquillage
  [
    {
      name: 'Maquillage soirée',
      description: 'Maquillage glamour pour soirée, gala ou remise de diplôme. Résistant, longue tenue.',
      categoryName: 'Visage',
      durationMin: 60,
      basePrice: 15000,
      communes: [{ commune: 'Cocody', travelFee: 0 }, { commune: 'Riviera', travelFee: 500 }, { commune: 'Plateau', travelFee: 2000 }, { commune: 'Marcory', travelFee: 2500 }],
    },
    {
      name: 'Maquillage mariée',
      description: 'Maquillage complet pour le jour J. Essai inclus. Produits haute définition, résistant à la chaleur.',
      categoryName: 'Coupe femme',
      durationMin: 120,
      basePrice: 45000,
      communes: [{ commune: 'Cocody', travelFee: 0 }, { commune: 'Riviera', travelFee: 1000 }, { commune: 'Plateau', travelFee: 3000 }],
    },
    {
      name: 'Maquillage naturel quotidien',
      description: 'Look nude et naturel adapté au quotidien. Léger, lumineux, effet peau parfaite.',
      categoryName: 'Visage',
      durationMin: 45,
      basePrice: 8000,
      communes: [{ commune: 'Cocody', travelFee: 0 }, { commune: 'Riviera', travelFee: 500 }],
    },
  ],
  // Kadidia — Cils
  [
    {
      name: 'Extensions cils volume russe',
      description: 'Pose complète en volume russe pour un regard intense et dramatique. Duree 2h30.',
      categoryName: 'Visage',
      durationMin: 150,
      basePrice: 22000,
      communes: [{ commune: 'Cocody', travelFee: 0 }, { commune: 'Angré', travelFee: 0 }, { commune: 'Riviera', travelFee: 1000 }, { commune: 'Plateau', travelFee: 2000 }],
    },
    {
      name: 'Extensions cils naturel',
      description: 'Pose en style naturel, allonge et ouvre le regard sans effet dramatique. Idéal pour le quotidien.',
      categoryName: 'Visage',
      durationMin: 90,
      basePrice: 15000,
      communes: [{ commune: 'Cocody', travelFee: 0 }, { commune: 'Angré', travelFee: 0 }, { commune: 'Marcory', travelFee: 2000 }],
    },
    {
      name: 'Retouche cils',
      description: 'Retouche des cils posés (3 à 4 semaines après la pose initiale). Résultat comme au premier jour.',
      categoryName: 'Visage',
      durationMin: 60,
      basePrice: 10000,
      communes: [{ commune: 'Cocody', travelFee: 0 }, { commune: 'Angré', travelFee: 0 }, { commune: 'Riviera', travelFee: 1000 }],
    },
  ],
];

async function seedServices(proIds: string[], categoryMap: Map<string, string>): Promise<string[][]> {
  const allServiceIds: string[][] = [];

  for (let i = 0; i < proIds.length; i++) {
    const proId = proIds[i];
    const defs = PRO_SERVICES[i];
    const serviceIds: string[] = [];

    for (const def of defs) {
      const categoryId = categoryMap.get(def.categoryName);
      if (!categoryId) {
        console.warn(`  ! Catégorie introuvable: ${def.categoryName}`);
        continue;
      }

      const existing = await prisma.serviceOffering.findFirst({
        where: { professionalId: proId, name: def.name },
        select: { id: true },
      });

      let serviceId: string;
      if (existing) {
        serviceId = existing.id;
        await prisma.serviceOffering.update({
          where: { id: serviceId },
          data: {
            description: def.description,
            durationMin: def.durationMin,
            basePrice: def.basePrice,
            categoryId,
            isActive: true,
            deletedAt: null,
          },
        });
      } else {
        serviceId = randomUUID();
        await prisma.serviceOffering.create({
          data: {
            id: serviceId,
            professionalId: proId,
            categoryId,
            name: def.name,
            description: def.description,
            durationMin: def.durationMin,
            basePrice: def.basePrice,
            isActive: true,
            metadata: { seededBy: SEED_TAG },
          },
        });
      }

      serviceIds.push(serviceId);

      // Commune fees
      for (const cf of def.communes) {
        await prisma.communeFee.upsert({
          where: { serviceOfferingId_commune: { serviceOfferingId: serviceId, commune: cf.commune } },
          update: { travelFee: cf.travelFee, isAvailable: true, deletedAt: null },
          create: {
            id: randomUUID(),
            serviceOfferingId: serviceId,
            commune: cf.commune,
            travelFee: cf.travelFee,
            isAvailable: true,
            metadata: { seededBy: SEED_TAG },
          },
        });
      }
    }

    allServiceIds.push(serviceIds);
  }

  const total = allServiceIds.reduce((s, ids) => s + ids.length, 0);
  console.log(`✓ Services: ${total}`);
  return allServiceIds;
}

// ─── Availability ─────────────────────────────────────────────────────────────

// dayOfWeek: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

const WORKING_DAYS = [1, 2, 3, 4, 5, 6]; // Mon–Sat
const WORKING_DAYS_WITH_LONG_BREAK = [1, 2, 3, 4, 5]; // Mon–Fri

type AvailabilityDef = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStartTime?: string;
  breakEndTime?: string;
};

function buildStandardAvailability(days: number[], start: string, end: string, breakStart?: string, breakEnd?: string): AvailabilityDef[] {
  return days.map((d) => ({ dayOfWeek: d, startTime: start, endTime: end, breakStartTime: breakStart, breakEndTime: breakEnd }));
}

const PRO_AVAILABILITIES: AvailabilityDef[][] = [
  buildStandardAvailability(WORKING_DAYS, '08:00', '18:00', '13:00', '14:00'),
  buildStandardAvailability(WORKING_DAYS, '09:00', '19:00', '13:00', '14:30'),
  buildStandardAvailability([1, 2, 3, 4, 5], '09:00', '17:00', '12:30', '13:30'),
  buildStandardAvailability(WORKING_DAYS, '08:30', '18:30', '12:00', '13:00'),
  buildStandardAvailability([2, 3, 4, 5, 6], '10:00', '20:00'),
  buildStandardAvailability(WORKING_DAYS, '09:00', '18:00', '13:00', '14:00'),
];

async function seedAvailability(proIds: string[]): Promise<void> {
  for (let i = 0; i < proIds.length; i++) {
    const proId = proIds[i];
    const defs = PRO_AVAILABILITIES[i];

    for (const def of defs) {
      const existing = await prisma.availability.findFirst({
        where: { professionalId: proId, dayOfWeek: def.dayOfWeek, deletedAt: null },
        select: { id: true },
      });

      if (existing) {
        await prisma.availability.update({
          where: { id: existing.id },
          data: {
            startTime: def.startTime,
            endTime: def.endTime,
            breakStartTime: def.breakStartTime ?? null,
            breakEndTime: def.breakEndTime ?? null,
            status: 'OPEN',
            isActive: true,
          },
        });
      } else {
        await prisma.availability.create({
          data: {
            id: randomUUID(),
            professionalId: proId,
            dayOfWeek: def.dayOfWeek,
            startTime: def.startTime,
            endTime: def.endTime,
            breakStartTime: def.breakStartTime ?? null,
            breakEndTime: def.breakEndTime ?? null,
            status: 'OPEN',
            isActive: true,
            metadata: { seededBy: SEED_TAG },
          },
        });
      }
    }
  }

  console.log(`✓ Disponibilités créées`);
}

// ─── Gallery ──────────────────────────────────────────────────────────────────

// Using picsum.photos with seed for consistent reproducible images
const PRO_GALLERY: { imageUrl: string; caption: string; category: string }[][] = [
  // Awa — Coiffure
  [
    { imageUrl: 'https://picsum.photos/seed/awa1/800/600', caption: 'Brushing sur cheveux naturels', category: 'Coupe femme' },
    { imageUrl: 'https://picsum.photos/seed/awa2/800/600', caption: 'Soin kératine - avant/après', category: 'Coupe femme' },
    { imageUrl: 'https://picsum.photos/seed/awa3/800/600', caption: 'Coupe et brushing élégant', category: 'Coupe femme' },
    { imageUrl: 'https://picsum.photos/seed/awa4/800/600', caption: 'Mise en plis longue durée', category: 'Coupe femme' },
  ],
  // Fatoumata — Tresses
  [
    { imageUrl: 'https://picsum.photos/seed/fatou1/800/600', caption: 'Box braids medium - résultat final', category: 'Coupe femme' },
    { imageUrl: 'https://picsum.photos/seed/fatou2/800/600', caption: 'Knotless braids avec accessoires', category: 'Coupe femme' },
    { imageUrl: 'https://picsum.photos/seed/fatou3/800/600', caption: 'Cornrows motifs géométriques', category: 'Coupe femme' },
    { imageUrl: 'https://picsum.photos/seed/fatou4/800/600', caption: 'Goddess braids avec bun', category: 'Coupe femme' },
  ],
  // Aminata — Ongles
  [
    { imageUrl: 'https://picsum.photos/seed/ami1/800/600', caption: 'Nail art floral printemps', category: 'Ongle' },
    { imageUrl: 'https://picsum.photos/seed/ami2/800/600', caption: 'French gel longue durée', category: 'Ongle' },
    { imageUrl: 'https://picsum.photos/seed/ami3/800/600', caption: 'Ombré rose dorée', category: 'Ongle' },
    { imageUrl: 'https://picsum.photos/seed/ami4/800/600', caption: 'Manucure + pédicure assortis', category: 'Ongle' },
  ],
  // Ibrahim — Barbier
  [
    { imageUrl: 'https://picsum.photos/seed/ibra1/800/600', caption: 'Dégradé peau + barbe sculptée', category: 'Coupe de cheveux homme' },
    { imageUrl: 'https://picsum.photos/seed/ibra2/800/600', caption: 'Dégradé américain classique', category: 'Coupe de cheveux homme' },
    { imageUrl: 'https://picsum.photos/seed/ibra3/800/600', caption: 'Taille barbe full', category: 'Coupe de cheveux homme' },
    { imageUrl: 'https://picsum.photos/seed/ibra4/800/600', caption: 'Contours razor précis', category: 'Coupe de cheveux homme' },
  ],
  // Mariam — Maquillage
  [
    { imageUrl: 'https://picsum.photos/seed/mariam1/800/600', caption: 'Maquillage mariée naturel', category: 'Visage' },
    { imageUrl: 'https://picsum.photos/seed/mariam2/800/600', caption: 'Look soirée smoky eyes', category: 'Visage' },
    { imageUrl: 'https://picsum.photos/seed/mariam3/800/600', caption: 'Maquillage baptême élégant', category: 'Visage' },
    { imageUrl: 'https://picsum.photos/seed/mariam4/800/600', caption: 'Look naturel quotidien', category: 'Visage' },
  ],
  // Kadidia — Cils
  [
    { imageUrl: 'https://picsum.photos/seed/kadi1/800/600', caption: 'Volume russe - regard intense', category: 'Visage' },
    { imageUrl: 'https://picsum.photos/seed/kadi2/800/600', caption: 'Extensions naturelles - douceur', category: 'Visage' },
    { imageUrl: 'https://picsum.photos/seed/kadi3/800/600', caption: 'Mega volume dramatique', category: 'Visage' },
    { imageUrl: 'https://picsum.photos/seed/kadi4/800/600', caption: 'Mix naturel-volume', category: 'Visage' },
  ],
];

async function seedGallery(proIds: string[]): Promise<void> {
  for (let i = 0; i < proIds.length; i++) {
    const proId = proIds[i];
    const items = PRO_GALLERY[i];

    for (let order = 0; order < items.length; order++) {
      const item = items[order];
      const existing = await prisma.galleryItem.findFirst({
        where: { professionalId: proId, imageUrl: item.imageUrl },
        select: { id: true },
      });

      if (!existing) {
        await prisma.galleryItem.create({
          data: {
            id: randomUUID(),
            professionalId: proId,
            imageUrl: item.imageUrl,
            caption: item.caption,
            category: item.category,
            order,
            isPublic: true,
            metadata: { seededBy: SEED_TAG },
          },
        });
      }
    }
  }

  console.log(`✓ Galeries créées`);
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function daysFromNow(n: number, hour = 10, minute = 0): Date {
  const d = new Date(Date.now() + n * 24 * 60 * 60 * 1000);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

function pastDate(n: number, hour = 10, minute = 0): Date {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

async function seedBookings(
  clientIds: string[],
  proIds: string[],
  allServiceIds: string[][],
): Promise<void> {
  type BookingCreate = {
    id: string;
    clientId: string;
    professionalId: string;
    serviceId: string;
    status: string;
    scheduledAt: Date;
    durationMin: number;
    totalPrice: number;
    travelFee: number;
    commune: string;
    address?: string;
    clientNotes?: string;
    confirmedAt?: Date;
    cancelledAt?: Date;
    cancellationNote?: string;
    cancellationRequestStatus: string;
    metadata: object;
  };

  const bookings: BookingCreate[] = [
    // ── COMPLETED (passées) ────────────────────────────────
    {
      id: randomUUID(),
      clientId: clientIds[0], // Marie
      professionalId: proIds[0], // Awa
      serviceId: allServiceIds[0][0], // Brushing
      status: 'COMPLETED',
      scheduledAt: pastDate(14, 10, 0),
      durationMin: 90,
      totalPrice: 8000,
      travelFee: 0,
      commune: 'Cocody',
      address: 'Riviera 3, Résidence Les Jardins',
      clientNotes: 'Cheveux légèrement abîmés aux pointes',
      confirmedAt: pastDate(15),
      cancellationRequestStatus: 'NONE',
      metadata: { seededBy: SEED_TAG },
    },
    {
      id: randomUUID(),
      clientId: clientIds[1], // Jean-Baptiste
      professionalId: proIds[3], // Ibrahim
      serviceId: allServiceIds[3][2], // Forfait homme
      status: 'COMPLETED',
      scheduledAt: pastDate(10, 11, 0),
      durationMin: 90,
      totalPrice: 10000,
      travelFee: 0,
      commune: 'Yopougon',
      address: 'Niangon Nord, face école',
      confirmedAt: pastDate(11),
      cancellationRequestStatus: 'NONE',
      metadata: { seededBy: SEED_TAG },
    },
    {
      id: randomUUID(),
      clientId: clientIds[2], // Sarah
      professionalId: proIds[2], // Aminata
      serviceId: allServiceIds[2][0], // Pose gel
      status: 'COMPLETED',
      scheduledAt: pastDate(7, 14, 30),
      durationMin: 90,
      totalPrice: 13500,
      travelFee: 1500,
      commune: 'Treichville',
      address: 'Avenue 9, immeuble Sanogo',
      confirmedAt: pastDate(8),
      cancellationRequestStatus: 'NONE',
      metadata: { seededBy: SEED_TAG },
    },
    {
      id: randomUUID(),
      clientId: clientIds[3], // David
      professionalId: proIds[3], // Ibrahim
      serviceId: allServiceIds[3][0], // Dégradé
      status: 'COMPLETED',
      scheduledAt: pastDate(5, 9, 0),
      durationMin: 60,
      totalPrice: 7000,
      travelFee: 2000,
      commune: 'Plateau',
      address: 'Rue des Jardins, plateau',
      confirmedAt: pastDate(6),
      cancellationRequestStatus: 'NONE',
      metadata: { seededBy: SEED_TAG },
    },
    {
      id: randomUUID(),
      clientId: clientIds[4], // Fatou
      professionalId: proIds[1], // Fatoumata
      serviceId: allServiceIds[1][0], // Box braids
      status: 'COMPLETED',
      scheduledAt: pastDate(20, 9, 0),
      durationMin: 300,
      totalPrice: 26000,
      travelFee: 1000,
      commune: 'Cocody',
      address: 'Riviera Palmeraie, villa 12',
      confirmedAt: pastDate(21),
      cancellationRequestStatus: 'NONE',
      metadata: { seededBy: SEED_TAG },
    },
    {
      id: randomUUID(),
      clientId: clientIds[0], // Marie
      professionalId: proIds[4], // Mariam
      serviceId: allServiceIds[4][0], // Maquillage soirée
      status: 'COMPLETED',
      scheduledAt: pastDate(3, 16, 0),
      durationMin: 60,
      totalPrice: 15000,
      travelFee: 0,
      commune: 'Cocody',
      address: 'Riviera Golf, entrée B',
      clientNotes: 'Soirée de gala, tenue bordeaux',
      confirmedAt: pastDate(4),
      cancellationRequestStatus: 'NONE',
      metadata: { seededBy: SEED_TAG },
    },

    // ── CONFIRMED (à venir) ────────────────────────────────
    {
      id: randomUUID(),
      clientId: clientIds[0], // Marie
      professionalId: proIds[0], // Awa
      serviceId: allServiceIds[0][1], // Soin kératine
      status: 'CONFIRMED',
      scheduledAt: daysFromNow(3, 10, 0),
      durationMin: 180,
      totalPrice: 35000,
      travelFee: 0,
      commune: 'Cocody',
      address: 'Riviera 3, Résidence Les Jardins',
      clientNotes: 'Première fois avec la kératine',
      confirmedAt: daysAgo(1),
      cancellationRequestStatus: 'NONE',
      metadata: { seededBy: SEED_TAG },
    },
    {
      id: randomUUID(),
      clientId: clientIds[2], // Sarah
      professionalId: proIds[5], // Kadidia
      serviceId: allServiceIds[5][0], // Volume russe
      status: 'CONFIRMED',
      scheduledAt: daysFromNow(5, 11, 0),
      durationMin: 150,
      totalPrice: 22000,
      travelFee: 0,
      commune: 'Cocody',
      address: 'Angré 8ème tranche, rue 12',
      confirmedAt: daysAgo(1),
      cancellationRequestStatus: 'NONE',
      metadata: { seededBy: SEED_TAG },
    },
    {
      id: randomUUID(),
      clientId: clientIds[1], // Jean-Baptiste
      professionalId: proIds[3], // Ibrahim
      serviceId: allServiceIds[3][1], // Taille barbe
      status: 'CONFIRMED',
      scheduledAt: daysFromNow(2, 9, 30),
      durationMin: 30,
      totalPrice: 5000,
      travelFee: 2000,
      commune: 'Plateau',
      address: 'Immeuble CCIA, niveau 3',
      confirmedAt: daysAgo(0),
      cancellationRequestStatus: 'NONE',
      metadata: { seededBy: SEED_TAG },
    },
    {
      id: randomUUID(),
      clientId: clientIds[4], // Fatou
      professionalId: proIds[4], // Mariam
      serviceId: allServiceIds[4][1], // Maquillage mariée
      status: 'CONFIRMED',
      scheduledAt: daysFromNow(10, 8, 0),
      durationMin: 120,
      totalPrice: 46000,
      travelFee: 1000,
      commune: 'Riviera',
      address: 'Hôtel Ivoire, salle Diamant',
      clientNotes: 'Mariage le 13. Tenue blanche ivoire.',
      confirmedAt: daysAgo(2),
      cancellationRequestStatus: 'NONE',
      metadata: { seededBy: SEED_TAG },
    },

    // ── PENDING ────────────────────────────────────────────
    {
      id: randomUUID(),
      clientId: clientIds[3], // David
      professionalId: proIds[0], // Awa
      serviceId: allServiceIds[0][2], // Coupe + brushing
      status: 'PENDING',
      scheduledAt: daysFromNow(4, 15, 0),
      durationMin: 120,
      totalPrice: 17000,
      travelFee: 2000,
      commune: 'Plateau',
      address: 'Boulevard de la République',
      cancellationRequestStatus: 'NONE',
      metadata: { seededBy: SEED_TAG },
    },
    {
      id: randomUUID(),
      clientId: clientIds[2], // Sarah
      professionalId: proIds[2], // Aminata
      serviceId: allServiceIds[2][1], // Nail art premium
      status: 'PENDING',
      scheduledAt: daysFromNow(6, 14, 0),
      durationMin: 120,
      totalPrice: 18000,
      travelFee: 0,
      commune: 'Marcory',
      clientNotes: 'Je voudrais un motif floral sur fond nude',
      cancellationRequestStatus: 'NONE',
      metadata: { seededBy: SEED_TAG },
    },
    {
      id: randomUUID(),
      clientId: clientIds[0], // Marie
      professionalId: proIds[1], // Fatoumata
      serviceId: allServiceIds[1][1], // Knotless braids
      status: 'PENDING',
      scheduledAt: daysFromNow(8, 9, 0),
      durationMin: 360,
      totalPrice: 30000,
      travelFee: 0,
      commune: 'Plateau',
      clientNotes: 'Longueur mi-dos, couleur naturelle',
      cancellationRequestStatus: 'NONE',
      metadata: { seededBy: SEED_TAG },
    },

    // ── CANCELLED ──────────────────────────────────────────
    {
      id: randomUUID(),
      clientId: clientIds[1], // Jean-Baptiste
      professionalId: proIds[2], // Aminata
      serviceId: allServiceIds[2][2], // Mani + pédi
      status: 'CANCELLED',
      scheduledAt: pastDate(8, 11, 0),
      durationMin: 120,
      totalPrice: 15000,
      travelFee: 1000,
      commune: 'Treichville',
      cancelledAt: pastDate(9),
      cancellationNote: 'Empêchement de dernière minute',
      cancellationRequestStatus: 'NONE',
      metadata: { seededBy: SEED_TAG },
    },
    {
      id: randomUUID(),
      clientId: clientIds[4], // Fatou
      professionalId: proIds[0], // Awa
      serviceId: allServiceIds[0][0], // Brushing
      status: 'CANCELLED',
      scheduledAt: pastDate(12, 10, 0),
      durationMin: 90,
      totalPrice: 9000,
      travelFee: 1000,
      commune: 'Riviera',
      cancelledAt: pastDate(13),
      cancellationNote: 'Annulé par le professionnel — indisponibilité',
      cancellationRequestStatus: 'NONE',
      metadata: { seededBy: SEED_TAG },
    },

    // ── NO_SHOW ────────────────────────────────────────────
    {
      id: randomUUID(),
      clientId: clientIds[3], // David
      professionalId: proIds[5], // Kadidia
      serviceId: allServiceIds[5][2], // Retouche cils
      status: 'NO_SHOW',
      scheduledAt: pastDate(6, 10, 0),
      durationMin: 60,
      totalPrice: 10000,
      travelFee: 0,
      commune: 'Cocody',
      confirmedAt: pastDate(7),
      cancellationRequestStatus: 'NONE',
      metadata: { seededBy: SEED_TAG },
    },

    // ── CONFIRMED avec demande d'annulation en attente ─────
    {
      id: randomUUID(),
      clientId: clientIds[1], // Jean-Baptiste
      professionalId: proIds[4], // Mariam
      serviceId: allServiceIds[4][2], // Maquillage quotidien
      status: 'CONFIRMED',
      scheduledAt: daysFromNow(7, 13, 0),
      durationMin: 45,
      totalPrice: 8500,
      travelFee: 500,
      commune: 'Riviera',
      clientNotes: 'Entretien professionnel',
      confirmedAt: daysAgo(2),
      cancellationRequestStatus: 'PENDING',
      metadata: { seededBy: SEED_TAG },
    },
  ];

  let created = 0;
  for (const b of bookings) {
    const existing = await prisma.booking.findFirst({
      where: {
        clientId: b.clientId,
        professionalId: b.professionalId,
        scheduledAt: b.scheduledAt,
      },
      select: { id: true },
    });

    if (!existing) {
      await prisma.booking.create({ data: b as any });
      created++;
    }
  }

  console.log(`✓ Bookings: ${created} créés (${bookings.length - created} existants ignorés)`);
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

async function seedReviews(proIds: string[]): Promise<void> {
  const completedBookings = await prisma.booking.findMany({
    where: {
      professionalId: { in: proIds },
      status: 'COMPLETED',
      deletedAt: null,
      reviewSession: null,
    },
    include: {
      professional: { select: { id: true, userId: true } },
    },
    take: 10,
  });

  const reviewTemplates = [
    { rating: 5, comment: 'Prestation parfaite ! Très professionnelle, résultat impeccable. Je recommande vivement.' },
    { rating: 5, comment: 'Excellent travail. Ponctuelle, soigneuse et de très bon conseil. Je reviens !' },
    { rating: 4, comment: 'Très contente du résultat. Quelques minutes de retard mais travail de qualité.' },
    { rating: 5, comment: "Je suis conquise ! Mes amies ont adore. Reservation facilitee via l'appli." },
    { rating: 4, comment: "Bon rapport qualite/prix. A l'ecoute de mes demandes. Reviendrai avec plaisir." },
    { rating: 5, comment: 'Service 5 étoiles. Matériel professionnel, mains habiles. Résultat top !' },
  ];

  let created = 0;
  for (let i = 0; i < completedBookings.length; i++) {
    const booking = completedBookings[i];
    const tpl = reviewTemplates[i % reviewTemplates.length];
    const now = new Date();

    const session = await prisma.reviewSession.create({
      data: {
        id: randomUUID(),
        bookingId: booking.id,
        expiresAt: new Date(now.getTime() - 1),
        revealedAt: now,
      },
    });

    await prisma.review.create({
      data: {
        id: randomUUID(),
        sessionId: session.id,
        bookingId: booking.id,
        reviewerType: 'CLIENT',
        reviewerId: booking.clientId,
        revieweeId: booking.professional.userId,
        professionalId: booking.professionalId,
        rating: tpl.rating,
        comment: tpl.comment,
        editableUntil: now,
        isEdited: false,
        isVisible: true,
        metadata: { seededBy: SEED_TAG },
      },
    });
    created++;
  }

  console.log(`✓ Avis: ${created}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n🌱 Début du seed Sefaizo...\n');

  const pinHash = await bcrypt.hash(TEST_PIN, 12);

  const categoryMap = await seedCategories();
  const { clients, pros: proUserIds } = await seedUsers(pinHash);
  const proIds = await seedProfessionals(proUserIds);
  const allServiceIds = await seedServices(proIds, categoryMap);
  await seedAvailability(proIds);
  await seedGallery(proIds);
  await seedBookings(clients, proIds, allServiceIds);
  await seedReviews(proIds);

  console.log('\n✅ Seed terminé.\n');
  console.log('─────────────────────────────────────────────');
  console.log('  Comptes de test (PIN: 2025)');
  console.log('─────────────────────────────────────────────');
  console.log('  CLIENTS');
  SEED_CLIENTS.forEach((u) => console.log(`  ${u.phone}  →  ${u.firstName} ${u.lastName}`));
  console.log('');
  console.log('  PROFESSIONNELS');
  SEED_PROS.forEach((u, i) => console.log(`  ${u.phone}  →  ${PRO_PROFILES[i].agencyName}`));
  console.log('─────────────────────────────────────────────\n');
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
