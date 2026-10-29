-- Additive visibility metadata only: no UPDATE, DELETE, backfill or provider action.
ALTER TABLE "Agreement" ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedById" TEXT, ADD COLUMN "archiveReason" TEXT,
  ADD COLUMN "archiveVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_archivedById_fkey"
  FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Agreement_archivedAt_kind_idx" ON "Agreement"("archivedAt", "kind");
CREATE TABLE "AgreementArchiveEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "agreementId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL, "action" TEXT NOT NULL CHECK ("action" IN ('ARCHIVE','RESTORE')),
  "reason" TEXT NOT NULL CHECK (char_length("reason") BETWEEN 3 AND 500),
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "version" INTEGER NOT NULL,
  CONSTRAINT "AgreementArchiveEvent_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AgreementArchiveEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AgreementArchiveEvent_agreementId_version_key" ON "AgreementArchiveEvent"("agreementId", "version");
CREATE INDEX "AgreementArchiveEvent_agreementId_occurredAt_idx" ON "AgreementArchiveEvent"("agreementId", "occurredAt");
