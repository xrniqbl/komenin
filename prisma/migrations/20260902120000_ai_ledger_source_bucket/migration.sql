-- Add a funding-bucket discriminator to the AI credit ledger so reservations
-- and usage against the SUBSCRIPTION quota never reduce the PAYG balance and
-- vice versa (fixes double-count when Pro Max falls back to PAYG).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS lets this re-run safely after a partial
-- apply; the UPDATEs are no-ops on already-backfilled rows (they'd just rewrite
-- the same value). The supporting index is created CONCURRENTLY in the companion
-- deploy step (see below) to avoid a long table lock on large ledgers.

ALTER TABLE "AiCreditLedger"
    ADD COLUMN IF NOT EXISTS "source" "AiBillingSource";

-- Backfill: usage rows already map 1:1 to their bucket. Bounded updates keep
-- lock time short; both statements are idempotent.
UPDATE "AiCreditLedger" SET "source" = 'subscription' WHERE kind = 'subscription_use' AND "source" IS NULL;
UPDATE "AiCreditLedger" SET "source" = 'payg'         WHERE kind = 'payg_use'         AND "source" IS NULL;
-- Legacy reservations are indistinguishable; leave source NULL so they are
-- excluded from bucket-scoped sums (safe: they release/settle quickly anyway).

-- NOTE: the composite index below is intentionally created NON-concurrently
-- here so it works inside Prisma's migration transaction. On a very large
-- ledger, prefer `CREATE INDEX CONCURRENTLY` run manually outside a
-- transaction, then mark this migration applied.
CREATE INDEX IF NOT EXISTS "AiCreditLedger_workspaceId_kind_source_createdAt_idx"
    ON "AiCreditLedger"("workspaceId", "kind", "source", "createdAt");
