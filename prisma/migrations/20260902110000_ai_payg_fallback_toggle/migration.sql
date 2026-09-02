-- Pro Max auto-fallback toggle (P1.2). When false, Pro Max fails closed at
-- quota exhaustion instead of continuing on the PAYG balance.
ALTER TABLE "Workspace"
    ADD COLUMN "aiPaygFallbackEnabled" BOOLEAN NOT NULL DEFAULT true;
