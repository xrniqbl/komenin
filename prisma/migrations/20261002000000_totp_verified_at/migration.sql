-- H1: server-side TOTP clearance per device session.
-- The JWT totpGate flag is cleared only when this column says so — the client
-- can no longer clear the gate via a session update (see jwt callback).
ALTER TABLE "LoginSession" ADD COLUMN "totpVerifiedAt" TIMESTAMP(3);
