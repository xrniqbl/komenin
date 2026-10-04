-- M5: durable single-use nonce registry for SSO tickets + OAuth states.
-- The UNIQUE constraint makes the claim atomic (exactly one concurrent
-- consumer wins, losers get P2002). Rows are pruned opportunistically.
CREATE TABLE "ConsumedNonce" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "nonceHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumedNonce_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConsumedNonce_nonceHash_key" ON "ConsumedNonce"("nonceHash");

CREATE INDEX "ConsumedNonce_expiresAt_idx" ON "ConsumedNonce"("expiresAt");
