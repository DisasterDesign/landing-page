-- Preserve the original receipt VAT independently of current client tax defaults.
ALTER TABLE "FinanceTransaction" ADD COLUMN "vatIlsMinor" INTEGER;
