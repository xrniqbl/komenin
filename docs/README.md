# Komenin / Lokarouter — Documentation

Social media automation platform (Next.js App Router + Prisma + PostgreSQL).
Live social actions flow through an external bridge implementing
[BRIDGE-CONTRACT.md](./BRIDGE-CONTRACT.md). Product domain: **komenin.id**.

## Start here

| Task | Read |
|---|---|
| Go from clone to running app | Root `README.md` |
| Promote a deploy to live mode | [PRODUCTION-CHECKLIST.md](./PRODUCTION-CHECKLIST.md) |
| Build/implement a bridge | [BRIDGE-CONTRACT.md](./BRIDGE-CONTRACT.md) + [integrators/](./integrators/) |
| Understand a subsystem | [architecture/](./architecture/) ADRs |

## Layout

- `architecture/` — ADR-001 social bridge pattern, ADR-002 worker processing, ADR-003 session encryption
- `security/` — security audit notes
- `testing/` — testing strategy
- `monitoring/` — monitoring & observability strategy
- `deploy/` — deployment guide (Docker + Vercel)
- `integrators/` — bridge implementer guides: contract, worker integration, live webhook setup, FAQ, checklist
- `superpowers/` — internal plans & specs (design docs per epic)

## Verification gates

```bash
npx tsc --noEmit   # type check
npm test           # vitest (unit suites)
npm run lint       # eslint, zero warnings
npm run build      # next build
```

All four must pass before a release candidate.

## Status (2026-08-27)

- Unit/integration tests, lint, type check, production build: **passing**
- Live social delivery: contract + client + mock bridge **shipped**; a real external bridge (or the mock, local only) is required for `SIMULATOR_MODE=false`
- Known deferred items are listed inside `PRODUCTION-CHECKLIST.md`
