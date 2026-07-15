# Aether

Enterprise social operations control plane for Instagram, Threads, and TikTok.

## Stack

- Next.js App Router + TypeScript + Tailwind
- Auth.js (Google)
- Prisma + Neon
- Coss / Base UI
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
   - `SIMULATOR_MODE=true` (default)
   - `WORKER_SECRET` (for `/api/worker/run`)
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

## Worker jobs

Simulator-friendly jobs are available:

```powershell
npm run worker:tick
npm run worker:health
npm run worker:poll
npm run worker:generate
npm run worker:send
```

Or HTTP:

```powershell
curl -X POST http://localhost:3000/api/worker/run `
  -H "Authorization: Bearer $env:WORKER_SECRET" `
  -H "Content-Type: application/json" `
  -d '{"job":"worker.tick"}'
```

Jobs:
- `session.health_check`
- `listener.poll`
- `comment.generate`
- `comment.send`
- `worker.tick` (all of the above)

## Current readiness

- Session Routing + Comment approval flow: demo-ready in simulator mode
- Agent Intelligence / Skill Execution: shell only
- Live platform connectors: not implemented yet
- Production multi-account ops: not ready

## Notes

- Default mode is simulator (`SIMULATOR_MODE=true`)
- Secrets are encrypted at rest with `ENCRYPTION_KEY`
- Approvals support draft editing before schedule
- Audit logs are readable under `/app/audit-logs`