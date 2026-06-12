-- CreateTable
CREATE TABLE "DupeReview" (
    "id" SERIAL NOT NULL,
    "aId" INTEGER NOT NULL,
    "bId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DupeReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DupeReview_aId_bId_key" ON "DupeReview"("aId", "bId");

