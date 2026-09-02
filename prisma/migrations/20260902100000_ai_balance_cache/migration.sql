-- Cached running AI credit balance per workspace (P0.3). A rebuildable
-- projection of the append-only AiCreditLedger, maintained in the same
-- transaction as each ledger write so reads avoid full-scan SUM().
CREATE TABLE "WorkspaceAiBalance" (
    "workspaceId" TEXT NOT NULL,
    "paygCredits" BIGINT NOT NULL DEFAULT 0,
    "subscriptionUsed" BIGINT NOT NULL DEFAULT 0,
    "quotaPeriodStart" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceAiBalance_pkey" PRIMARY KEY ("workspaceId")
);

ALTER TABLE "WorkspaceAiBalance"
    ADD CONSTRAINT "WorkspaceAiBalance_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
