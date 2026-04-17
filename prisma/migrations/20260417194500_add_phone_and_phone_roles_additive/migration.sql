-- CreateTable
CREATE TABLE "phones" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "phones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_roles" (
    "id" TEXT NOT NULL,
    "phoneId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "phones_number_key" ON "phones"("number");

-- CreateIndex
CREATE UNIQUE INDEX "phone_roles_phoneId_role_key" ON "phone_roles"("phoneId", "role");

-- CreateIndex
CREATE INDEX "phone_roles_userId_idx" ON "phone_roles"("userId");

-- AddForeignKey
ALTER TABLE "phone_roles" ADD CONSTRAINT "phone_roles_phoneId_fkey" FOREIGN KEY ("phoneId") REFERENCES "phones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_roles" ADD CONSTRAINT "phone_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill phones from existing users
INSERT INTO "phones" (
  "id",
  "number",
  "isVerified",
  "metadata",
  "createdAt",
  "updatedAt",
  "deletedAt"
)
SELECT
  u."id",
  u."phone",
  u."isVerified",
  u."metadata",
  u."createdAt",
  u."updatedAt",
  u."deletedAt"
FROM "users" u
ON CONFLICT ("number") DO NOTHING;

-- Backfill existing user role into phone_roles
INSERT INTO "phone_roles" (
  "id",
  "phoneId",
  "userId",
  "role",
  "metadata",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT('legacy-role-', u."id", '-', u."role"),
  p."id",
  u."id",
  u."role",
  jsonb_build_object('source', 'legacy-user-role'),
  NOW(),
  NOW()
FROM "users" u
JOIN "phones" p ON p."number" = u."phone"
ON CONFLICT ("phoneId", "role") DO NOTHING;

-- Ensure PROFESSIONAL role exists for users that already have a professional profile
INSERT INTO "phone_roles" (
  "id",
  "phoneId",
  "userId",
  "role",
  "metadata",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT('legacy-pro-role-', pr."id"),
  p."id",
  pr."userId",
  'PROFESSIONAL'::"Role",
  jsonb_build_object('source', 'legacy-professional-profile'),
  NOW(),
  NOW()
FROM "professionals" pr
JOIN "users" u ON u."id" = pr."userId"
JOIN "phones" p ON p."number" = u."phone"
WHERE pr."deletedAt" IS NULL
ON CONFLICT ("phoneId", "role") DO NOTHING;
