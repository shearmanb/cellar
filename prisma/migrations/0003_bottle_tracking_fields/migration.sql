-- AlterTable
ALTER TABLE "Bottle" ADD COLUMN     "vabcAllocated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "addedToVabcAt" DATE,
ADD COLUMN     "firstAppearance" DATE;
