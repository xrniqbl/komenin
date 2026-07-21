import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";
import { verifySsoTicket } from "@/lib/sso-ticket";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
      async authorize(credentials) {
        const ticket = String(credentials?.ticket || "");
        const payload = verifySsoTicket(ticket);
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
        };
      },
    }),
  ],
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
