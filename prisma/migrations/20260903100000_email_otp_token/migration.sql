-- Email OTP sign-in tokens (hashed 6-digit codes, single-use, attempt-capped).
CREATE TABLE "EmailOtpToken" (
    "id"         TEXT NOT NULL,
    "email"      TEXT NOT NULL,
    "codeHash"   TEXT NOT NULL,
    "salt"       TEXT NOT NULL,
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "attempts"   INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOtpToken_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailOtpToken_email_createdAt_idx" ON "EmailOtpToken"("email", "createdAt");
