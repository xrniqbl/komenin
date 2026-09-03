import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";
import { verifySsoTicket } from "@/lib/sso-ticket";
import { normalizeEmail, verifyEmailOtp } from "@/lib/email-otp";

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
    Credentials({
      id: "email-otp",
      name: "Email OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const email = normalizeEmail(String(credentials?.email || ""));
        const code = String(credentials?.code || "");
        if (!email || !code) return null;

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
