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
  trustHost: true,
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