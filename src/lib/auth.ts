import { randomUUID } from "node:crypto";

import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";
import { verifyEmailOtp, normalizeEmail } from "@/lib/email-otp";
import { consumeSsoTicketOnce } from "@/lib/sso-ticket";

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
        // verifies — otherwise the second internal verify would fail. The
        // claim is atomic in the DB (M5) so a sniffed ticket cannot mint a
        // second session via another instance inside the TTL window.
        const payload = await consumeSsoTicketOnce(ticket);
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
        if (!result.ok) {
          // Security signal without PII: the workspace is unknown pre-login, so
          // this row is workspace-less by design. Throttled by the OTP attempt
          // cap (5/code) plus the per-IP/per-email route limits.
          try {
            const { db: auditDb } = await import("@/lib/db");
            await auditDb.auditLog.create({
              data: {
                action: "auth.otp.verify_failed",
                resourceType: "user",
                metadata: { reason: result.reason },
              },
            });
          } catch {
            // Audit must never block authentication.
          }
          return null;
        }

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
    async jwt({ token, user, account, trigger }) {
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
        //
        // Fail-closed on ERROR: a DB failure here must never disable the 2FA
        // gate (default gated) nor mint an untracked session. A definitive
        // "user row not found" is not an error — a brand-new user cannot have
        // 2FA yet, so the gate stays off to avoid a bogus challenge.
        let totpEnabled = false;
        let suspended = false;
        let dbError = false;
        try {
          const dbUser = await db.user.findUnique({
            where: { id: user.id },
            select: { totpEnabledAt: true, suspendedAt: true },
          });
          totpEnabled = Boolean(dbUser?.totpEnabledAt);
          suspended = Boolean(dbUser?.suspendedAt);
        } catch {
          dbError = true;
          totpEnabled = true;
        }
        token.totpGate = totpEnabled;
        if (suspended) {
          token.revoked = true;
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
            // Without a LoginSession row the revocation poll would kill this
            // token within 60s anyway — refuse the sign-in up front instead
            // of minting a session that appears logged-out. Only first-time
            // users mid-adapter-persist (no readable row, no DB error) fall
            // through; the poll treats their missing row as revoked.
            if (dbError) {
              throw new Error("Could not create device session; try again");
            }
          }
        }
        return token;
      }

      if (trigger === "update") {
        // H1: the TOTP gate is NEVER cleared from a client-supplied session
        // value. useSession().update() lets any logged-in browser send
        // arbitrary `session.user` fields — previously `totpGate: false` from
        // the client silently opened every gated guard without a 2FA code.
        // Clearance now happens server-side only: verifyTotpGate /
        // confirmTotpEnrollment stamp LoginSession.totpVerifiedAt, and the
        // revocation poll below re-opens the gate unless that row says passed.
        // Triggering a re-poll keeps the UX identical (one refresh after
        // verify lands on the cleared state) without trusting the client.
        token.rcAt = 0;
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
          // Poll both revocation sources in one try — a connect/pool failure
          // must not read as "row missing → revoked". A transient Neon idle
          // disconnect used to permanently kill every active session (users
          // stuck in a /login ↔ /app redirect loop). On error the session is
          // KEPT and revocation is simply deferred to the next throttle
          // cycle; worst case, a revocation lands one outage + 60s late.
          try {
            const row = await db.loginSession.findUnique({
              where: { jti: token.jti },
              select: { revokedAt: true, totpVerifiedAt: true },
            });
            if (!row || row.revokedAt) {
              token.revoked = true;
              delete token.sub;
              return token;
            }
            // Server-side TOTP clearance: the gate stays ON unless this device
            // session's row carries a totpVerifiedAt stamp (written by
            // verifyTotpGate / confirmTotpEnrollment after a valid code).
            // Client-supplied session values can never clear it (H1).
            token.totpGate = row.totpVerifiedAt ? false : token.totpGate === true;
            // Platform suspension also ends existing sessions (same throttle).
            const user = await db.user.findUnique({
              where: { id: token.sub },
              select: { suspendedAt: true },
            });
            if (user?.suspendedAt) {
              token.revoked = true;
              delete token.sub;
              return token;
            }
            token.dbFailures = 0;
          } catch (error) {
            const failures =
              typeof token.dbFailures === "number" ? token.dbFailures + 1 : 1;
            token.dbFailures = failures;
            console.error(
              `[auth] revocation poll DB error (streak ${failures}) — session kept, re-check deferred`,
              error instanceof Error ? error.message : error,
            );
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
        } else if (typeof token.dbFailures === "number" && token.dbFailures >= 10) {
          // DB has been unreachable for ≥10 consecutive poll cycles (~10 min):
          // stop trusting the last-good state, revoke defensively. A genuine
          // suspension then takes effect within minutes of the DB returning,
          // while brief blips still ride through.
          token.revoked = true;
          delete token.sub;
          console.error("[auth] DB unreachable across 10 revocation polls — revoking session defensively");
          return token;
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
