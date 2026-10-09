import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-safe Auth.js config (no Prisma).
 * Used by middleware and as the base for the Node auth instance.
 */
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  // JWT keeps middleware off Prisma/edge runtime.
  // PrismaAdapter still persists users/accounts in the Node auth instance.
  session: { strategy: "jwt" },
  // Host trust: Auth.js derives the request URL from the Host header, so an
  // explicit trustHost=false rejects EVERYTHING (all session/signin/signout
  // calls fail with UntrustedHost -> "server configuration" error page).
  // Trust the host when AUTH_URL is set: next-auth rewrites the request URL
  // origin to AUTH_URL (reqWithEnvURL) before validation, so the effective
  // host is our canonical origin, not attacker input. The production gate +
  // preflight enforce AUTH_URL == APP_URL == https://<canonical domain>.
  // Local dev keeps `true` so http://localhost:3000 and 127.0.0.1 both work
  // without setting AUTH_URL.
  trustHost: Boolean(
    process.env.AUTH_URL?.trim() ||
      (process.env.NODE_ENV !== "production" && !process.env.VERCEL_ENV),
  ),
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      if (session.user) {
        // Shared by the edge proxy and the Node instance: the TOTP gate and
        // device revocation are enforced by Node-side guards (workspace-access).
        session.user.totpGate = Boolean(token.totpGate);
        session.currentJti = token.jti;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;