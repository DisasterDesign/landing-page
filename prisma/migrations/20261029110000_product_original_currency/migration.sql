-- AlterTable
ALTER TABLE "ClientProduct" ADD COLUMN     "monthlyOriginalAmount" DOUBLE PRECISION,
ADD COLUMN     "monthlyOriginalCurrency" TEXT,
ADD COLUMN     "monthlyPriceVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ClientProductPriceRevision" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "restoredFromId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientProductPriceRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientProductPriceRevision_productId_occurredAt_idx" ON "ClientProductPriceRevision"("productId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientProductPriceRevision_productId_version_key" ON "ClientProductPriceRevision"("productId", "version");

-- AddForeignKey
ALTER TABLE "ClientProductPriceRevision" ADD CONSTRAINT "ClientProductPriceRevision_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ClientProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProductPriceRevision" ADD CONSTRAINT "ClientProductPriceRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing rows keep their nullable ILS valuation. No financial backfill.
ALTER TABLE "ClientProduct" ADD CONSTRAINT "ClientProduct_original_price_check" CHECK (
  "monthlyPriceVersion" >= 0 AND (
    ("monthlyOriginalAmount" IS NULL AND "monthlyOriginalCurrency" IS NULL) OR
    ("monthlyOriginalAmount" IS NOT NULL AND "monthlyOriginalCurrency" IS NOT NULL AND "monthlyOriginalAmount" >= 0 AND
     "monthlyOriginalAmount" < 90071992547409 AND
     round("monthlyOriginalAmount"::numeric, 2) = "monthlyOriginalAmount"::numeric AND
     (("monthlyOriginalCurrency" = 'ILS' AND "monthlyAmount" IS NOT NULL AND "monthlyAmount" = "monthlyOriginalAmount") OR
      ("monthlyOriginalCurrency" = 'USD' AND "monthlyAmount" IS NULL)))
  )
);
