import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  // Keep JWT strategy from authConfig so edge middleware stays Prisma-free.
  session: { strategy: "jwt" },
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