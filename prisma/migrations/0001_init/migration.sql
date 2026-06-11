-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PendingStatus" AS ENUM ('PENDING', 'MATCHED', 'IGNORED');

-- CreateTable
CREATE TABLE "Bottle" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "distillery" TEXT,
    "category" TEXT,
    "tier" TEXT,
    "myTier" TEXT,
    "vabcCode" TEXT,
    "msrp" DECIMAL(10,2),
    "warn" TEXT,
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bottle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alias" (
    "id" SERIAL NOT NULL,
    "bottleId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Alias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Release" (
    "id" SERIAL NOT NULL,
    "bottleId" INTEGER NOT NULL,
    "year" TEXT,
    "batch" TEXT,
    "label" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreListing" (
    "id" SERIAL NOT NULL,
    "store" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "bottleId" INTEGER NOT NULL,
    "title" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingBottle" (
    "id" SERIAL NOT NULL,
    "store" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "vendor" TEXT,
    "url" TEXT,
    "image" TEXT,
    "price" DECIMAL(10,2),
    "status" "PendingStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedBottleId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingBottle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bottle_brand_idx" ON "Bottle"("brand");

-- CreateIndex
CREATE INDEX "Bottle_tier_idx" ON "Bottle"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "Alias_code_key" ON "Alias"("code");

-- CreateIndex
CREATE INDEX "Alias_bottleId_idx" ON "Alias"("bottleId");

-- CreateIndex
CREATE INDEX "Release_bottleId_idx" ON "Release"("bottleId");

-- CreateIndex
CREATE INDEX "StoreListing_bottleId_idx" ON "StoreListing"("bottleId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreListing_store_handle_key" ON "StoreListing"("store", "handle");

-- CreateIndex
CREATE INDEX "PendingBottle_status_idx" ON "PendingBottle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PendingBottle_store_handle_key" ON "PendingBottle"("store", "handle");

-- AddForeignKey
ALTER TABLE "Alias" ADD CONSTRAINT "Alias_bottleId_fkey" FOREIGN KEY ("bottleId") REFERENCES "Bottle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_bottleId_fkey" FOREIGN KEY ("bottleId") REFERENCES "Bottle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreListing" ADD CONSTRAINT "StoreListing_bottleId_fkey" FOREIGN KEY ("bottleId") REFERENCES "Bottle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingBottle" ADD CONSTRAINT "PendingBottle_resolvedBottleId_fkey" FOREIGN KEY ("resolvedBottleId") REFERENCES "Bottle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

