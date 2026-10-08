-- DropForeignKey
ALTER TABLE "WorkspaceAiSubscription" DROP CONSTRAINT "WorkspaceAiSubscription_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "AiCreditLedger" DROP CONSTRAINT "AiCreditLedger_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "WorkspaceAiBalance" DROP CONSTRAINT "WorkspaceAiBalance_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "AiUsageEvent" DROP CONSTRAINT "AiUsageEvent_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "SubscriptionOrder" DROP CONSTRAINT "SubscriptionOrder_workspaceId_fkey";

-- CreateTable
CREATE TABLE "BridgeIdempotencyKey" (
    "key" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "body" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BridgeIdempotencyKey_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "BridgeIdempotencyKey_expiresAt_idx" ON "BridgeIdempotencyKey"("expiresAt");

-- AddForeignKey
ALTER TABLE "WorkspaceAiSubscription" ADD CONSTRAINT "WorkspaceAiSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCreditLedger" ADD CONSTRAINT "AiCreditLedger_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceAiBalance" ADD CONSTRAINT "WorkspaceAiBalance_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionOrder" ADD CONSTRAINT "SubscriptionOrder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

