-- CreateTable
CREATE TABLE "BrandRule" (
    "id" SERIAL NOT NULL,
    "brand" TEXT NOT NULL,
    "brandKey" TEXT NOT NULL,
    "distillery" TEXT,
    "category" TEXT,
    "ndp" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandRule_brandKey_key" ON "BrandRule"("brandKey");
