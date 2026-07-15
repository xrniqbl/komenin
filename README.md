# Aether

Enterprise social operations control plane for Instagram, Threads, and TikTok.

## Stack

- Next.js App Router + TypeScript + Tailwind
- Auth.js (Google)
- Prisma + Neon
- Vitest

## Setup

1. Create a Neon Postgres database and set `DATABASE_URL`
2. Create a Google Cloud OAuth web client with redirect:
   - `http://localhost:3000/api/auth/callback/google`
3. Copy `.env.example` to `.env.local` and fill:
   - `AUTH_SECRET`
   - `AUTH_GOOGLE_ID`
   - `AUTH_GOOGLE_SECRET`
   - `ENCRYPTION_KEY` (64 hex chars)
4. Install and prepare database:

```powershell
npm install
npx prisma generate
npx prisma db push
npm run dev
```

5. Open:
- `/` marketing site
- `/signup` Google auth
- `/onboarding` workspace creation
- `/app` command center

## Notes

- Untitled UI official init was blocked by environment approval/network constraints in this session.
- Current UI uses Quiet Control Plane tokens and clean Tailwind primitives aligned to the approved design system.
- Session Routing is implemented: multi-tunnel accounts grid, proxy pool, session vault, health probes, and IP rotation logs.
- Comment Engine, Agent Intelligence, and Skill Execution are next.
