-- Harden Komenin AI monetization persistence and monthly quota semantics.
-- Applies after 20260827110000_ai_monetization.

-- Plan metadata used by checkout fulfillment.
CREATE TYPE "PlanKind" AS ENUM ('social', 'ai_subscription', 'ai_credits');
ALTER TABLE "Plan"
    ADD COLUMN "kind" "PlanKind" NOT NULL DEFAULT 'social',
    ADD COLUMN "aiCredits" BIGINT;

-- Persist workspace BYOK preference instead of assuming true in the router.
ALTER TABLE "Workspace"
    ADD COLUMN "aiPreferOwnKey" BOOLEAN NOT NULL DEFAULT true;

-- Typed subscription / ledger / billing-source states.
CREATE TYPE "AiSubscriptionStatus" AS ENUM ('active', 'past_due', 'canceled', 'expired');
CREATE TYPE "AiLedgerKind" AS ENUM (
    'grant',
    'reservation',
    'reservation_release',
    'subscription_use',
    'payg_use',
    'refund',
    'expire'
);
CREATE TYPE "AiBillingSource" AS ENUM ('own_key', 'subscription', 'payg');

-- Subscription: split commitment term from independently rolling monthly quota.
ALTER TABLE "WorkspaceAiSubscription"
    ADD COLUMN "termStart" TIMESTAMP(3),
    ADD COLUMN "termEnd" TIMESTAMP(3),
    ADD COLUMN "quotaPeriodStart" TIMESTAMP(3),
    ADD COLUMN "quotaPeriodEnd" TIMESTAMP(3),
    ADD COLUMN "pendingTier" "AiTier",
    ADD COLUMN "pendingMonthlyCredits" BIGINT,
    ADD COLUMN "pendingPlanCode" TEXT,
    ADD COLUMN "sourceOrderId" TEXT;

UPDATE "WorkspaceAiSubscription"
SET
    "termStart" = "currentPeriodStart",
    "termEnd" = "currentPeriodEnd",
    "quotaPeriodStart" = "currentPeriodStart",
    "quotaPeriodEnd" = LEAST("currentPeriodEnd", "currentPeriodStart" + INTERVAL '1 month');

ALTER TABLE "WorkspaceAiSubscription"
    ALTER COLUMN "termStart" SET NOT NULL,
    ALTER COLUMN "termEnd" SET NOT NULL,
    ALTER COLUMN "quotaPeriodStart" SET NOT NULL,
    ALTER COLUMN "quotaPeriodEnd" SET NOT NULL;

ALTER TABLE "WorkspaceAiSubscription"
    DROP COLUMN "currentPeriodStart",
    DROP COLUMN "currentPeriodEnd";

ALTER TABLE "WorkspaceAiSubscription"
    ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "WorkspaceAiSubscription"
    ALTER COLUMN "status" TYPE "AiSubscriptionStatus"
    USING "status"::"AiSubscriptionStatus";
ALTER TABLE "WorkspaceAiSubscription"
    ALTER COLUMN "status" SET DEFAULT 'active';

CREATE UNIQUE INDEX "WorkspaceAiSubscription_sourceOrderId_key"
    ON "WorkspaceAiSubscription"("sourceOrderId");
CREATE INDEX "WorkspaceAiSubscription_quotaPeriodEnd_idx"
    ON "WorkspaceAiSubscription"("quotaPeriodEnd");
CREATE INDEX "WorkspaceAiSubscription_termEnd_idx"
    ON "WorkspaceAiSubscription"("termEnd");

-- Usage events get stable request id + reported/estimated provenance.
ALTER TABLE "AiUsageEvent"
    ADD COLUMN "requestId" TEXT,
    ADD COLUMN "usageSource" TEXT NOT NULL DEFAULT 'reported';

-- Existing rows did not carry request ids; backfill deterministically from id.
UPDATE "AiUsageEvent" SET "requestId" = 'legacy:' || "id" WHERE "requestId" IS NULL;
ALTER TABLE "AiUsageEvent" ALTER COLUMN "requestId" SET NOT NULL;
CREATE UNIQUE INDEX "AiUsageEvent_requestId_key" ON "AiUsageEvent"("requestId");

ALTER TABLE "AiUsageEvent"
    ALTER COLUMN "billedTo" TYPE "AiBillingSource"
    USING "billedTo"::"AiBillingSource";

-- Ledger effects become idempotent and traceable.
ALTER TABLE "AiCreditLedger"
    ADD COLUMN "operationId" TEXT,
    ADD COLUMN "sourceOrderId" TEXT,
    ADD COLUMN "usageEventId" TEXT;

UPDATE "AiCreditLedger" SET "operationId" = 'legacy:' || "id" WHERE "operationId" IS NULL;
ALTER TABLE "AiCreditLedger" ALTER COLUMN "operationId" SET NOT NULL;
CREATE UNIQUE INDEX "AiCreditLedger_operationId_key" ON "AiCreditLedger"("operationId");
CREATE UNIQUE INDEX "AiCreditLedger_usageEventId_key" ON "AiCreditLedger"("usageEventId");
CREATE INDEX "AiCreditLedger_sourceOrderId_idx" ON "AiCreditLedger"("sourceOrderId");

ALTER TABLE "AiCreditLedger"
    ALTER COLUMN "balanceAfter" DROP NOT NULL,
    ALTER COLUMN "kind" TYPE "AiLedgerKind"
    USING "kind"::"AiLedgerKind";

ALTER TABLE "AiCreditLedger"
    ADD CONSTRAINT "AiCreditLedger_usageEventId_fkey"
    FOREIGN KEY ("usageEventId") REFERENCES "AiUsageEvent"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
