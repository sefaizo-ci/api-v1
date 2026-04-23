-- CreateEnum
CREATE TYPE "ServiceCategoryRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Keep previous category name while resetting the category catalog
ALTER TABLE "service_offerings"
ADD COLUMN "legacyCategoryName" TEXT;

UPDATE "service_offerings" AS so
SET "legacyCategoryName" = c."name"
FROM "service_categories" c
WHERE so."categoryId" = c."id";

-- Drop constraints/indexes tied to professional-scoped categories
ALTER TABLE "service_offerings" DROP CONSTRAINT IF EXISTS "service_offerings_categoryId_fkey";
ALTER TABLE "service_categories" DROP CONSTRAINT IF EXISTS "service_categories_professionalId_fkey";
DROP INDEX IF EXISTS "service_categories_professionalId_name_key";
DROP INDEX IF EXISTS "service_categories_professionalId_idx";

-- Remove old rows and convert categories to global catalog
DELETE FROM "service_categories";
ALTER TABLE "service_categories" DROP COLUMN IF EXISTS "professionalId";

-- Recreate unique global category index
CREATE UNIQUE INDEX IF NOT EXISTS "service_categories_name_key" ON "service_categories"("name");
CREATE INDEX IF NOT EXISTS "service_categories_name_idx" ON "service_categories"("name");

-- Seed global category catalog (V1)
INSERT INTO "service_categories" ("id", "name", "description", "isActive", "createdAt", "updatedAt", "deletedAt", "metadata") VALUES
('11111111-1111-4111-8111-111111111111', 'Coiffure et soins capillaires', 'Coupes, brushing, mises en plis et soins capillaires courants pour l''entretien regulier des cheveux.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111112', 'Tresses et coiffures africaines', 'Tresses traditionnelles et modernes avec techniques afro specialisees.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111113', 'Locks et dreadlocks', 'Pose, entretien et soins dedies aux locks et dreadlocks.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111114', 'Extensions et pose de perruques', 'Pose de tissages, extensions et perruques avec finitions professionnelles.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111115', 'Manucure et ongles', 'Manucure classique, gel, resine, polygel, nail art et extensions d''ongles.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111116', 'Pedicure et soins des pieds', 'Pedicure esthetique, soins des pieds et vernis semi-permanent.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111117', 'Maquillage', 'Maquillage quotidien, soiree, evenementiel et mariee.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111118', 'Epilation', 'Epilation du visage et du corps selon differentes techniques non invasives.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111119', 'Soins du visage et esthetique', 'Nettoyage, hydratation, gommage, masques et soins esthetiques du visage.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111120', 'Massage et relaxation', 'Massages bien-etre et techniques de relaxation non medicales.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111121', 'Extensions de cils', 'Pose, remplissage et entretien d''extensions de cils.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111122', 'Sourcils et microblading', 'Restructuration des sourcils, microblading, microshading et techniques associees.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111123', 'Soins du corps et enveloppements', 'Gommages, enveloppements et soins corporels de confort et d''esthetique.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111124', 'Barbier et soins homme', 'Coupe homme, barbe, rasage et entretien capillaire masculin.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111125', 'Henne et tatouage temporaire', 'Application de henne et ornements corporels temporaires.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111126', 'Bien-etre et therapies douces', 'Yoga, respiration, meditation guidee et pratiques de bien-etre non medicales.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111127', 'Maquillage permanent et semi-permanent', 'Pigmentation esthetique durable selon techniques certifiees.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111128', 'Coloration et balayage', 'Coloration, meches, balayage, ombre et techniques de decoloration.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111129', 'Soins capillaires specialises', 'Protocoles intensifs pour cheveux fragilises: reparation, nutrition et hydratation profonde.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111130', 'Coiffure et beaute mariage', 'Prestations beaute packagees pour mariee et cortege.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111131', 'Spa et soins premium', 'Rituels complets de detente, soins duo et experiences bien-etre haut de gamme.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111132', 'Medecine esthetique et injections', 'Actes esthetiques medicaux reserves aux professionnels habilites.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111133', 'Tatouage et piercing', 'Tatouage artistique et prestations de piercing avec protocoles d''hygiene stricts.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111134', 'Soins prenataux et postnatal', 'Soins de confort adaptes a la grossesse et a l''apres-accouchement, hors acte medical.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111135', 'Consultation beaute et coaching', 'Diagnostic, conseil personnalise, relooking et accompagnement beaute.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111136', 'Coiffure et soins enfants', 'Prestations capillaires adaptees aux enfants avec techniques douces.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111137', 'Soins des mains et paraffine', 'Soins hydratants, paraffine, gommage et massage des mains.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111138', 'Minceur et remodelage corporel', 'Protocoles esthetiques de remodelage non chirurgicaux selon equipement et qualification.', true, NOW(), NOW(), NULL, '{}'::jsonb),
('11111111-1111-4111-8111-111111111139', 'Formation et masterclass beaute', 'Cours, ateliers et formations professionnelles en techniques beaute.', true, NOW(), NOW(), NULL, '{}'::jsonb);

-- Re-link every service offering to global categories, fallback to default one when needed
UPDATE "service_offerings" AS so
SET "categoryId" = c."id"
FROM "service_categories" c
WHERE LOWER(TRIM(COALESCE(so."legacyCategoryName", ''))) = LOWER(TRIM(c."name"));

UPDATE "service_offerings"
SET "categoryId" = '11111111-1111-4111-8111-111111111111'
WHERE "categoryId" IS NULL
   OR "categoryId" NOT IN (SELECT "id" FROM "service_categories");

ALTER TABLE "service_offerings"
ADD CONSTRAINT "service_offerings_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_offerings"
DROP COLUMN "legacyCategoryName";

-- Create table for professional category requests reviewed by admins
CREATE TABLE "service_category_requests" (
  "id" TEXT NOT NULL,
  "professionalId" TEXT NOT NULL,
  "proposedName" TEXT NOT NULL,
  "proposedDescription" TEXT,
  "status" "ServiceCategoryRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "approvedCategoryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "metadata" JSONB,

  CONSTRAINT "service_category_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_category_requests_professionalId_status_idx"
ON "service_category_requests"("professionalId", "status");

CREATE INDEX "service_category_requests_status_createdAt_idx"
ON "service_category_requests"("status", "createdAt");

ALTER TABLE "service_category_requests"
ADD CONSTRAINT "service_category_requests_professionalId_fkey"
FOREIGN KEY ("professionalId") REFERENCES "professionals"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_category_requests"
ADD CONSTRAINT "service_category_requests_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_category_requests"
ADD CONSTRAINT "service_category_requests_approvedCategoryId_fkey"
FOREIGN KEY ("approvedCategoryId") REFERENCES "service_categories"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
