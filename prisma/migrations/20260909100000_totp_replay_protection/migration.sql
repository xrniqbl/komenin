-- TOTP replay protection: track the last successfully verified counter step.
-- NULL = no code consumed yet (fresh enrollment or pre-existing user).
ALTER TABLE "User" ADD COLUMN "totpLastUsedStep" INTEGER;
