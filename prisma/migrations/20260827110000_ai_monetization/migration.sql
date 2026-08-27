-- Komenin AI monetization: subscription tiers + credit ledger + usage events

-- CreateEnum
CREATE TYPE "AiTier" AS ENUM ('none', 'starter', 'pro', 'pro_max');

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkspaceAiSubscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "tier" "AiTier" NOT NULL DEFAULT 'none',
    "monthlyCredits" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceAiSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AiCreditLedger" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "credits" BIGINT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AiUsageEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "providerId" TEXT,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "creditsUsed" BIGINT NOT NULL DEFAULT 0,
    "billedTo" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceAiSubscription_workspaceId_key"
    ON "WorkspaceAiSubscription"("workspaceId");
CREATE INDEX IF NOT EXISTS "WorkspaceAiSubscription_workspaceId_status_idx"
    ON "WorkspaceAiSubscription"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "AiCreditLedger_workspaceId_createdAt_idx"
    ON "AiCreditLedger"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiCreditLedger_workspaceId_kind_createdAt_idx"
    ON "AiCreditLedger"("workspaceId", "kind", "createdAt");
CREATE INDEX IF NOT EXISTS "AiUsageEvent_workspaceId_createdAt_idx"
    ON "AiUsageEvent"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkspaceAiSubscription"
    ADD CONSTRAINT "WorkspaceAiSubscription_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCreditLedger"
    ADD CONSTRAINT "AiCreditLedger_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiUsageEvent"
    ADD CONSTRAINT "AiUsageEvent_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
