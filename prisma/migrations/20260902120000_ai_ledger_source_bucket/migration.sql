-- Add a funding-bucket discriminator to the AI credit ledger so reservations
-- and usage against the SUBSCRIPTION quota never reduce the PAYG balance and
-- vice versa (fixes double-count when Pro Max falls back to PAYG).

ALTER TABLE "AiCreditLedger"
    ADD COLUMN "source" "AiBillingSource";

-- Backfill: usage rows already map 1:1 to their bucket.
UPDATE "AiCreditLedger" SET "source" = 'subscription' WHERE kind = 'subscription_use';
UPDATE "AiCreditLedger" SET "source" = 'payg'         WHERE kind = 'payg_use';
-- Legacy reservations are indistinguishable; leave source NULL so they are
-- excluded from bucket-scoped sums (safe: they release/settle quickly anyway).

CREATE INDEX "AiCreditLedger_workspaceId_kind_source_createdAt_idx"
    ON "AiCreditLedger"("workspaceId", "kind", "source", "createdAt");
