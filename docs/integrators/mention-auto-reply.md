# Mention Auto-Reply

Fitur auto-reply untuk komentar/mention yang masuk di akun sosial milik
workspace. Semua teks di sini mengikuti implementasi aktual (bukan rencana).

## Arsitektur

```
Webhook platform                        Worker (Vercel Cron)
────────────────                        ─────────────────────
POST /api/connectors/webhooks/          cron */5 → job=mention.process
  {instagram,threads,tiktok}                 │
  ├─ HMAC verify (fail-closed)               ▼
  ├─ parse (Meta/Threads/TikTok)       Mention (status=new)
  ├─ resolve workspace/account               │
  └─ Mention rows (dedup unik) ─────────────►│ claim atomis (status=generating)
                                             ▼
                                    AutoReplySettings?
                                    ├─ off / limit harian → ignored
                                    ├─ agent tidak ada    → failed + notif
                                    ├─ templateText       → render template (tanpa AI)
                                    └─ default            → AI generate (risk-scan)
                                             │
                       mode=auto & lolos & ada akun ──► CommentAction
                       lainnya ──────────────────────► Approval (review UI)
                                             (scheduled, delay manusiawi 45–180s)
```

Pengiriman balasan **tidak** dilakukan oleh `mention.process` — ia membuat
`CommentAction` dengan `source=mention_reply`, lalu job `comment.send`
(cron `*/2`) yang mengirim via connector (official/webhook/simulator) dan
men-update status Mention (`sent`/`failed`).

## Komponen

| Bagian | Lokasi |
| --- | --- |
| Webhook receiver + parser + resolver | `src/app/api/connectors/webhooks/[platform]/route.ts` |
| Pipeline job | `runMentionProcess` di `src/server/worker-jobs.ts` |
| Server actions (list/settings/approve/ignore/run) | `src/server/mention-replies.ts` |
| UI inbox + settings | `src/app/app/mentions/page.tsx` |
| Retry/backoff comment.send | `scheduleCommentActionRetry`, `isRetryableSendFailure` (worker-jobs) |
| Claim atomis | `src/lib/worker-claims.ts` (`claimMention`, `releaseStaleClaims`) |
| Template engine | `src/lib/template-engine.ts` |
| Skema DB | `Mention`, `AutoReplySettings`, `CommentAction.source/mentionId/attemptCount`, `CommentDraft.mentionId` |

## Konfigurasi

### Webhook (ingest masuk)

Semua fail-closed: tanpa secret platform, payload POST ditolak (503).

1. Daftarkan webhook URL: `https://<APP_URL>/api/connectors/webhooks/<platform>`
2. Set env:
   - `INSTAGRAM_APP_SECRET` (Meta X-Hub-Signature-256; juga dipakai Threads
     bila `THREADS_APP_SECRET` kosong)
   - `TIKTOK_CLIENT_SECRET` (TikTok signature)
   - `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` — wajib untuk handshake Meta; kosong =
     handshake menerima token apa pun (ada warning di readiness)
3. Meta GET handshake meng-echo `hub.challenge` setelah cek verify token.

Workspace di-resolve dari `SocialAccount.externalId` → fallback ke
`ConnectorCredential` aktif. Payload yang tidak bisa di-resolve di-drop (202/200)
agar platform tidak me-disable subscription.

### Worker

Cron sudah terdaftar di `vercel.json`:

- `?job=mention.process` tiap 5 menit
- `comment.send` tiap 2 menit (mengirim balasan yang sudah dischedule)

Jalankan manual dari UI: tombol **Process now** di `/app/mentions` (audit:
`mention.manual_run`).

## Auto-Reply settings (`/app/mentions`)

- **enabled** — induk pipeline; off = mention baru langsung `ignored`.
- **agent** — agent untuk knowledge/prompt; kosong = agent aktif pertama.
- **mode** — `approval_required` (default, semua balasan ditahan untuk review)
  atau `auto` (langsung dischedule bila lolos risk-scan dan ada akun pengirim).
- **maxRepliesPerDay** — hard cap 1–500 (default 20), dihitung dari
  `CommentAction` `mention_reply` hari ini.
- **quietHoursApply** — hormati quiet hours workspace di `comment.send`.
- **templateText** (F3) — template statis yang menimpa AI generation.
  Variabel: `{{authorHandle}} {{platform}} {{postSnippet}} {{agentName}} {{topic}}`.
  Template tetap melewati risk-scan; mengosongkannya kembali ke AI (pakai
  kredit). Model/provider draft tercatat sebagai `template`.

## Retry queue (F4)

Kegagalan sementara diklasifikasi `isRetryableSendFailure` (timeout, 429,
5xx, network/socket, "temporarily", "unavailable", dst). Retry memakai
`attemptCount` + backoff `2m → 10m → 30m`, maks 3 attempt total
(`MAX_COMMENT_SEND_ATTEMPTS`). Kegagalan permanen (preflight/policy/403) tetap
`failed` langsung. Idempotency key `comment-action:<id>` membuat crash-retry
tidak double-post di bridge.

## Metering AI (F4)

- Provider OpenAI-compatible/Anthropic kini melaporkan `usage` asli;
  `AiUsageEvent.usageSource` = `reported` saat provider mengirim token asli,
  `estimated` (chars/4, split 30/70) hanya saat provider tidak melaporkan.
- Template replies tidak memanggil AI → nol kredit.
- Quota habis tetap fail-closed: mention → `failed` + notif dedup harian.

## Partial refund (F4)

`transactionStatus=partial_refund` dari Midtrans kini membalikkan **porsi
proporsional** kredit AI (gross_amount / totalIdr × kredit order) dari grant
PAYG yang masih unspent (FIFO), idempoten via
`operationId=order:<id>:partial-refund`, tercatat di audit
`billing.order_partial_refund` dengan `refundAmountIdr` + `creditsRefunded`.
Entitlement subscription/plan tetap hidup — hanya kredit dibalikkan.
Full refund/chargeback tetap mencabut seluruh entitlement
(`revokeOrderEntitlements`).

## Metrics (F4)

`getWorkerMetrics()` (singleton `WorkerMetrics`) direkam di
`/api/worker/cron` per job: durasi, sukses/gagal, error type; failure rate
>10% memicu warning log + metrik `worker.jobs_total` /
`worker.jobs.errors`.

## Disconnect akun (F2)

`deleteAccount` (tombol **Disconnect account** di halaman detail akun):
soft-delete `deletedAt`, deaktivasi session aktif, proxy assignment, dan
`ConnectorCredential` milik akun. Sejarah (mentions, actions, logs) tetap
utuh. Akun yang sudah dihapus tidak bisa diproses webhook lagi
(resolver skip `deletedAt != null`).

## Discovery native (F2)

- Instagram `discoverPosts` via Graph `ig_hashtag_search` + `top_media`
  (butuh akun `accountId` + izin business discovery; gagal → fallback webhook).
- TikTok `sendComment` native via `/v2/comment/create/` (periksa juga blok
  `error.code !== "ok"` di body 200).

## Testing

```
npx vitest run tests/unit/mention-webhook.test.ts   # parser/verifier/ingest
npx vitest run tests/unit/mention-pipeline.test.ts  # retry + template
npx vitest run tests/unit/live-readiness.test.ts    # readiness mention ingest
```
