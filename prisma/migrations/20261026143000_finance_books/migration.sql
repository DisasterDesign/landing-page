-- Additive migration. Run backfill dry-run and review before deployment.
CREATE TYPE "FinanceBook" AS ENUM ('PRIVATE', 'SHARED', 'UNASSIGNED');
ALTER TABLE "Agreement" ADD COLUMN "financeBook" "FinanceBook" NOT NULL DEFAULT 'UNASSIGNED';
ALTER TABLE "ClientProduct" ADD COLUMN "financeBook" "FinanceBook" NOT NULL DEFAULT 'UNASSIGNED';
ALTER TABLE "ClientJob" ADD COLUMN "financeBook" "FinanceBook" NOT NULL DEFAULT 'UNASSIGNED';
ALTER TABLE "Expense" ADD COLUMN "financeBook" "FinanceBook" NOT NULL DEFAULT 'UNASSIGNED', ADD COLUMN "sharedBasisPoints" INTEGER, ADD COLUMN "clientProductId" TEXT;
CREATE TABLE "FinanceTransaction" (
  "id" TEXT NOT NULL, "provider" TEXT NOT NULL, "terminalId" TEXT NOT NULL,
  "providerTransactionId" TEXT NOT NULL, "kind" TEXT NOT NULL DEFAULT 'CHARGE',
  "amountMinor" INTEGER NOT NULL, "currency" TEXT NOT NULL, "ilsAmountMinor" INTEGER,
  "occurredAt" TIMESTAMP(3) NOT NULL, "financeBook" "FinanceBook" NOT NULL DEFAULT 'UNASSIGNED',
  "clientId" TEXT, "clientProductId" TEXT, "agreementId" TEXT, "invoiceNumber" TEXT,
  "accountId" INTEGER, "recurringId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FinanceSyncState" (
  "key" TEXT NOT NULL, "status" TEXT NOT NULL, "lastAttemptAt" TIMESTAMP(3) NOT NULL,
  "lastSuccessAt" TIMESTAMP(3), "coveredFrom" TIMESTAMP(3), "coveredTo" TIMESTAMP(3), "error" TEXT, "metadata" JSONB,
  CONSTRAINT "FinanceSyncState_pkey" PRIMARY KEY ("key")
);
CREATE UNIQUE INDEX "FinanceTransaction_provider_terminalId_providerTransactionI_key" ON "FinanceTransaction"("provider", "terminalId", "providerTransactionId", "kind");
CREATE INDEX "FinanceTransaction_financeBook_occurredAt_idx" ON "FinanceTransaction"("financeBook", "occurredAt");
CREATE INDEX "FinanceTransaction_clientId_occurredAt_idx" ON "FinanceTransaction"("clientId", "occurredAt");
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_sharedBasisPoints_check" CHECK ("sharedBasisPoints" IS NULL OR "sharedBasisPoints" BETWEEN 0 AND 10000);
-- No attribution backfill here: application script previews existing evidence before writing.

CREATE TABLE "FinanceExpensePayment" (
 "id" TEXT NOT NULL, "expenseId" TEXT NOT NULL, "paymentKey" TEXT NOT NULL,
 "amountIlsMinor" INTEGER NOT NULL, "paidAt" TIMESTAMP(3) NOT NULL,
 "financeBook" "FinanceBook" NOT NULL DEFAULT 'UNASSIGNED', "sharedBasisPoints" INTEGER,
 "clientId" TEXT, "clientProductId" TEXT, "paidById" TEXT NOT NULL,
 "frequency" "ExpenseFrequency" NOT NULL DEFAULT 'ONE_TIME', "reference" TEXT,
 "source" TEXT NOT NULL DEFAULT 'MANUAL', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "FinanceExpensePayment_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "FinanceExpensePayment_amount_check" CHECK ("amountIlsMinor" > 0),
 CONSTRAINT "FinanceExpensePayment_sharedBasisPoints_check" CHECK ("sharedBasisPoints" IS NULL OR "sharedBasisPoints" BETWEEN 0 AND 10000)
);
CREATE UNIQUE INDEX "FinanceExpensePayment_paymentKey_key" ON "FinanceExpensePayment"("paymentKey");
CREATE INDEX "FinanceExpensePayment_financeBook_paidAt_idx" ON "FinanceExpensePayment"("financeBook", "paidAt");
CREATE INDEX "FinanceExpensePayment_expenseId_paidAt_idx" ON "FinanceExpensePayment"("expenseId", "paidAt");
