-- CreateTable
CREATE TABLE "service_categories" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_professionalId_name_key" ON "service_categories"("professionalId", "name");
CREATE INDEX "service_categories_professionalId_idx" ON "service_categories"("professionalId");

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
