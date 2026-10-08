CREATE TABLE "BridgeIdempotency" (
  "key" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "httpStatus" INTEGER,
  "response" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BridgeIdempotency_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "BridgeIdempotency_expiresAt_idx" ON "BridgeIdempotency"("expiresAt");

CREATE TABLE "RefundReconciliation" (
  "id" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "orderId" TEXT,
  "transactionStatus" TEXT NOT NULL,
  "refundAmountIdr" INTEGER,
  "payload" JSONB NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'pending',
  "reason" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RefundReconciliation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RefundReconciliation_eventKey_key" ON "RefundReconciliation"("eventKey");
CREATE INDEX "RefundReconciliation_state_createdAt_idx" ON "RefundReconciliation"("state", "createdAt");
CREATE INDEX "RefundReconciliation_orderId_createdAt_idx" ON "RefundReconciliation"("orderId", "createdAt");
ALTER TABLE "RefundReconciliation" ADD CONSTRAINT "RefundReconciliation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SubscriptionOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
