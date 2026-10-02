# Prisma migrations

This repo historically used `prisma db push` for fast local iteration. Shared/staging/production environments should use migrations.

## Scripts

| Script | Use |
|--------|-----|
| `npm run db:push` | Local prototype only — applies schema without migration history |
| `npm run db:migrate` | Create/apply a migration in development (`prisma migrate dev`) |
| `npm run db:migrate:deploy` | Apply existing migrations in CI/staging/prod |
| `npm run db:migrate:status` | Show migration status |
| `npm run db:generate` | Generate Prisma Client |

## Baseline (first time)

If the database already matches `schema.prisma` but has no migration history:

```bash
# 1) Generate baseline SQL from current schema
npm run db:migrate:baseline
# equivalent: node scripts/generate-prisma-baseline.mjs

# 2) Mark baseline as applied without re-running SQL (existing DBs)
npx prisma migrate resolve --applied 0_init

# 3) From then on, use migrate for all schema changes
npm run db:migrate -- --name describe_change
```

For brand-new empty databases, prefer:

```bash
npm run db:migrate:baseline   # once, commit prisma/migrations/0_init
npm run db:migrate:deploy
```

after committing migration folders under `prisma/migrations/`.

## Policy

- Do **not** rely on `db:push` for shared environments.
- Keep `prisma/schema.prisma` as source of truth.
- Review generated SQL before applying to production.

## 20260923100000_mention_auto_reply

Mention ingest + auto-reply pipeline (Mention, AutoReplySettings, CommentSource,
MentionStatus, CommentAction/CommentDraft.mentionId, DeliveryKind.mention_ingest).
Webhook route: /api/connectors/webhooks/[platform]. Cron: mention.process */5.
Deploy: `prisma migrate deploy`, lalu verifikasi cron mention.process 200.
