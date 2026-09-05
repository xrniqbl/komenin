import { randomUUID } from "node:crypto";

import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";
import { verifyEmailOtp, normalizeEmail } from "@/lib/email-otp";
import { consumeSsoTicket } from "@/lib/sso-ticket";

type DeviceMeta = { userAgent?: string; ip?: string };

/** Spoof-resistant-ish client metadata for the device list (edge sets the first two). */
function deviceMetaFrom(request: Request | undefined): DeviceMeta {
  const h = request?.headers;
  const ip =
    h?.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h?.get("cf-connecting-ip")?.trim() ||
    h?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    undefined;
  return { userAgent: h?.get("user-agent") ?? undefined, ip };
}

function safeDeviceMeta(meta: DeviceMeta) {
  return {
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
    ip: meta.ip?.slice(0, 64) ?? null,
  };
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  // Keep JWT strategy from authConfig so edge middleware stays Prisma-free.
  session: { strategy: "jwt" },
  providers: [
    ...authConfig.providers,
    Credentials({
      id: "sso-ticket",
      name: "SSO Ticket",
      credentials: {
        ticket: { label: "Ticket", type: "text" },
      },
      async authorize(credentials, request) {
        const ticket = String(credentials?.ticket || "");
        // Single-use: the nonce is consumed here (the actual session-minting
        // step), not in the /api/auth/sso/complete pre-check, which only
        // verifies — otherwise the second internal verify would fail.
        const payload = consumeSsoTicket(ticket);
        if (!payload) return null;
        const user = await db.user.findUnique({ where: { id: payload.userId } });
        if (!user || user.email?.toLowerCase() !== payload.email.toLowerCase()) {
          return null;
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          deviceMeta: deviceMetaFrom(request),
        };
      },
    }),
    Credentials({
      id: "email-otp",
      name: "Email OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials, request) {
        const email = normalizeEmail(String(credentials?.email || ""));
        const code = String(credentials?.code || "");
        if (!email || !code) return null;

        // Suspended accounts never reach OTP verification (and never burn a code).
        const existing = await db.user.findUnique({
          where: { email },
          select: { suspendedAt: true },
        });
        if (existing?.suspendedAt) return null;

        const result = await verifyEmailOtp(email, code);
        if (!result.ok) return null;

        // Auto-create the account on first successful verify (mirrors the
        // Google OAuth first-sign-in path; the workspace is created later in
        // onboarding). Mark the email verified since the inbox proved ownership.
        const user = await db.user.upsert({
          where: { email },
          create: { email, emailVerified: new Date() },
          update: { emailVerified: new Date() },
        });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          deviceMeta: deviceMetaFrom(request),
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Node-runtime jwt callback: authConfig's edge-safe jwt stays for the
    // proxy; this one adds TOTP gating, device tracking, and revocation.
    async jwt({ token, user, account, trigger, session }) {
      if (user?.id) {
        token.sub = user.id;
      }

      if (trigger === "signIn" && user?.id) {
        // Fresh login: issue a device session row for list + revoke.
        const jti = randomUUID();
        token.jti = jti;
        token.revoked = false;
        token.rcAt = Date.now();
        token.lsAt = Date.now();
        token.totpGate = false;

        // TOTP: every provider (Google included) lands behind the gate when
        // the user has 2FA enabled; the challenge page clears it. Suspended
        // users get no device session at all — the revoked flag strips their
        // user id on the next guarded request.
        try {
          const dbUser = await db.user.findUnique({
            where: { id: user.id },
            select: { totpEnabledAt: true, suspendedAt: true },
          });
          token.totpGate = Boolean(dbUser?.totpEnabledAt);
          if (dbUser?.suspendedAt) {
            token.revoked = true;
          }
        } catch {
          token.totpGate = false;
        }

        if (!token.revoked) {
          try {
            await db.loginSession.create({
              data: {
                userId: user.id,
                jti,
                provider: account?.provider ?? null,
                ...safeDeviceMeta(user.deviceMeta ?? {}),
              },
            });
          } catch {
            // Device tracking must never block a legitimate login.
          }
        }
        return token;
      }

      if (trigger === "update" && session?.user && "totpGate" in session.user) {
        // The TOTP challenge page clears the flag via unstable_update.
        token.totpGate = Boolean(session.user.totpGate);
      }

      // Revocation + liveness checks — throttled to once per minute per token.
      if (token.revoked) {
        delete token.sub; // session loses user.id → guards treat as logged out
        return token;
      }
      if (token.jti && token.sub) {
        const now = Date.now();
        // Coerce explicitly — next-auth v5 beta types JWT extras loosely.
        const rcAt = typeof token.rcAt === "number" ? token.rcAt : 0;
        const lsAt = typeof token.lsAt === "number" ? token.lsAt : 0;
        if (now - rcAt > 60_000) {
          token.rcAt = now;
          const row = await db.loginSession
            .findUnique({
              where: { jti: token.jti },
              select: { revokedAt: true },
            })
            .catch(() => null);
          if (!row || row.revokedAt) {
            token.revoked = true;
            delete token.sub;
            return token;
          }
          // Platform suspension also ends existing sessions (same throttle).
          const user = await db.user
            .findUnique({
              where: { id: token.sub },
              select: { suspendedAt: true },
            })
            .catch(() => null);
          if (user?.suspendedAt) {
            token.revoked = true;
            delete token.sub;
            return token;
          }
          if (now - lsAt > 5 * 60_000) {
            token.lsAt = now;
            await db.loginSession
              .update({
                where: { jti: token.jti },
                data: { lastSeenAt: new Date() },
              })
              .catch(() => {});
          }
        }
      }
      return token;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      try {
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      } catch {
        // First-time OAuth users may not be fully persisted yet depending on adapter timing.
      }
    },
  },
});
