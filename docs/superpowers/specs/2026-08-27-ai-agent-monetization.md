# AI Agent Monetization — Design & Implementation Plan

**Date:** 2026-08-27
**Status:** Approved (owner decisions locked 2026-08-27) — implementation in progress
**Product:** Komenin (komenin.id)
**Epic:** "Bring your own AI" + "Komenin AI" subscription tiers + Pay-as-you-go credits

---

## 1. Ringkasan (Executive Summary)

Hari ini setiap workspace **harus** membawa API key AI sendiri (BYOK — Bring Your Own Key) lewat Settings → AI Providers. Proposal ini menjadikan AI sebagai **lini pendapatan kedua**:

1. **BYOK (gratis, tetap ada)** — workspace pakai key sendiri, biaya AI nol bagi kita
2. **Komenin AI (langganan bulanan)** — 3 tier: **Starter / Pro / Pro Max**. Kami yang menyediakan model (via 9Router/gateway kami), user tidak perlu key
3. **Pay-as-you-go (kredit prabayar)** — beli paket kredit token (mis. 100k credits @ Rp50k), dipakai kapan saja, tidak ada komitmen

**Keputusan arsitektur inti:** semua jalur melewati AI router yang sudah ada (`routeChatCompletion`). Yang ditambah adalah lapisan **metering + routing policy** per workspace: "workspace ini pakai key sendiri / kuota langganan / saldo kredit", diputuskan di satu tempat sebelum request keluar.

---

## 2. Model Bisnis & Harga (usulan, mudah diubah di catalog.ts)

### 2.1 Tier langganan Komenin AI (harga final — owner locked)

| | **AI Starter** | **AI Pro** | **AI Pro Max** |
|---|---|---|---|
| Harga/bulan | **Rp 50.000** | **Rp 150.000** | **Rp 250.000** |
| Harga/bulan (langganan 12 bulan, diskon 10%) | Rp 45.000 | Rp 135.000 | Rp 225.000 |
| **AI credits/bulan** | 1.000.000 | 5.000.000 | 25.000.000 |
| ≈ komentar AI (±150 tok/komentar) | ±6.600 | ±33.000 | ±166.000 |
| Model yang diizinkan | Economic (GPT-4o-mini class) | Economic + Standard (GPT-4o class) | Semua termasuk Premium (daftar model via 9Router disiapkan owner) |
| Fallback saat kuota habis | ❌ stop | ❌ stop | ✅ auto lanjut PAYG |
| Priority queue | ❌ | ✅ | ✅ + dedicated rate |
| Analitik biaya AI | dasar | lengkap | lengkap + export |

> 1 credit = 1 token (input+output, dihitung dari usage API).
> Struktur SKU: tiap tier punya 2 varian (`_1m` dan `_12m` dengan diskon 10%).

### 2.2 Pay-as-you-go (kredit prabayar)

| Paket | Harga | Credits | Bonus |
|---|---|---|---|
| PAYG-S | Rp 50.000 | 750.000 | — |
| PAYG-M | Rp 150.000 | 2.500.000 | +5% |
| PAYG-L | Rp 500.000 | 9.000.000 | +15% |

- Kredit **tidak kadaluarsa** selama akun aktif (12 bulan idle → hangus, per AUP)
- Terpakai **setelah** kuota langganan habis (subscription-first, PAYG fallback)
- Kombinasi dengan langganan plan sosial manapun (tier AI terpisah dari plan send/publish yang sudah ada)

### 2.3 Aturan pemakaian (routing policy per workspace)

```
Prioritas sumber AI:
1. Provider workspace sendiri (BYOK) — jika di-enable "prefer my own key"
2. Kuota langganan Komenin AI aktif (jika berlangganan)
3. Saldo PAYG (jika ada)
4. Gagal-tutup dengan pesan jelas + CTA upgrade
```

---

## 3. Desain Teknis

### 3.1 Perubahan schema Prisma (3 model baru + 1 enum)

```prisma
enum AiTier {
  none        // BYOK only / free
  starter
  pro
  pro_max
}

model WorkspaceAiSubscription {
  id            String   @id @default(cuid())
  workspaceId   String   @unique
  tier          AiTier   @default(none)
  monthlyCredits BigInt  @default(0)   // included credits per period
  status        String   @default("active") // active | past_due | canceled
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  workspace     Workspace @relation(...)
}

model AiCreditLedger {
  id          String   @id @default(cuid())
  workspaceId String
  // grant | subscription_use | payg_use | refund | expire
  kind        String
  credits     BigInt   // positif = tambah, negatif = pakai
  balanceAfter BigInt
  refType     String?  // "comment_action" | "content_draft" | "skill_run" | "order"
  refId       String?
  expiresAt   DateTime? // khusus grant PAYG
  createdAt   DateTime @default(now())
  workspace   Workspace @relation(...)

  @@index([workspaceId, createdAt])
}

model AiUsageEvent {
  id          String   @id @default(cuid())
  workspaceId String
  providerId  String?  // workspace provider (BYOK) atau "komenin:<model>"
  model       String
  inputTokens  Int
  outputTokens Int
  creditsUsed  BigInt  @default(0)   // 0 untuk BYOK
  billedTo     String  // own_key | subscription | payg
  latencyMs    Int?
  refType     String?
  refId       String?
  createdAt   DateTime @default(now())

  @@index([workspaceId, createdAt])
}
```

**Ledger append-only** (bukan saldo mutable) = audit-proof, bisa direkonstruksi, cocok dengan sifat billing yang sudah ada. Balance workspace = SUM(credits) ledger aktif (non-expired) — di-cache di Redis/memory kalau performa jadi isu, tapi mulai tanpa cache.

### 3.2 Metering di AI router (titik tunggal)

`routeChatCompletion` (dipakai comment-engine, content-engine, skills, test-provider) adalah **satu-satunya** jalur keluar AI. Ubah:

```
routeChatCompletion(request)
  → resolveAiBilling(workspaceId)          // NEW
     → tentukan: own_key | subscription | payg | blocked
  → jalankan provider (key workspace ATAU key gateway kami)
  → recordAiUsage(...)                      // NEW: tokens dari response.usage
```

- Token usage diambil dari `usage` field response API (OpenAI-compat & Anthropic sudah mengembalikan) — fallback estimasi `chars/4` bila provider tak melapor
- BYOK: `creditsUsed = 0`, tetap dicatat di AiUsageEvent (analitik "berapa kamu hemat") tanpa meng charge apa pun
- Gateway model kami: satu `AI_GATEWAY_*` env (sudah ada infra 9Router-nya) — key gateway **tidak pernah** keluar server

### 3.3 Pre-flight check (gagal-tutup sebelum request)

Sebelum request: cek sumber kredit. Kuota habis & tanpa PAYG → return structured error `AI_QUOTA_EXCEEDED` dengan sisa info; comment-pipeline menangani: draft ditandai `failed: quota`, notifikasi ke operator, **tidak di-retry otomatis** (sesuai pola fail-closed yang sudah ada).

### 3.4 Billing & checkout

Reuse penuh pipeline Midtrans yang ada:

- `DEFAULT_PLANS` bertambah 6 SKU: `ai_starter_1m`, `ai_pro_1m`, `ai_pro_max_1m`, `payg_s`, `payg_m`, `payg_l` — tipe baru `CatalogPlan.kind: "social" | "ai_subscription" | "ai_credits"`
- `applyPaidOrder` branch per kind:
  - `ai_subscription` → upsert `WorkspaceAiSubscription` + grant credits period
  - `ai_credits` → ledger `grant` dengan `expiresAt +12 bulan`
- Proration: **tidak ada di v1** — tier switch berlaku periode depan (simpel, jujur, mudah dijelaskan)
- Refund Midtrans existing → ledger `refund` menghapus grant terkait

### 3.5 UI

| Lokasi | Perubahan |
|---|---|
| Settings → AI | Tab baru **"Komenin AI"**: status tier, meter kredit (bar + angka), tombol upgrade/beli kredit, toggel "prefer my own key" |
| Pricing page | Section "AI add-on" 3 tier + 3 paket PAYG (table terpisah dari plan sosial) |
| Checkout | Reuse halaman checkout yang ada (snap Midtrans sama) |
| Analytics | Card "AI usage bulan ini": credits terpakai per sumber (own key vs subscription vs payg), top model, estimasi biaya |
| Notifikasi | Threshold 80% & 100% kuota → notification + email (Brevo) via pola digest yang sudah ada |

### 3.6 Keamanan & anti-abuse

- Rate limit per workspace untuk request AI gateway (mis. 60 req/menit, burst 120) — pakai `consumeRateLimit` yang ada
- Model allowlist per tier di-enforce **server-side** di router (bukan hanya UI)
- Key gateway: env-only, sama seperti sekarang; audit log untuk setiap grant/pemakaian besar
- AI Usage Event menyimpan model+tokens, **tidak menyimpan konten prompt** (privasi + ukuran data)

---

## 4. Rencana Implementasi (bertahap, tiap fase ter-deploy sendiri)

### Fase 1 — Fondasi metering (2–3 hari)
1. Migration: 3 model + enum + relasi Workspace
2. `src/lib/ai/billing.ts`: `resolveAiBilling`, `recordAiUsage`, `getAiBalance` (pure, unit-testable)
3. Ubah `routeChatCompletion` menerima `workspaceId` opsional + wire metering (BYOK tetap gratis & tercatat)
4. Unit tests: ledger math (grant/use/expire/refund), routing policy order, quota exceeded
5. UI: card status pemakaian AI di Settings → AI (read-only dulu)

### Fase 2 — Katalog & checkout (2 hari)
6. `catalog.ts`: 6 SKU baru + field `kind`; `entitlements.ts`: model allowlist per tier
7. `applyPaidOrder` branch ai_subscription / ai_credits + test
8. Pricing page section AI + checkout flow (snap Midtrans reuse)
9. Test E2E-level: order → paid → subscription aktif → credits granted

### Fase 3 — Enforcement & UX (2 hari)
10. Pre-flight quota check di comment-engine/content-engine/skills + fail-closed path
11. Threshold notifikasi 80%/100% (notification + email Brevo)
12. Settings → AI tab "Komenin AI" lengkap (upgrade, beli kredit, prefer-own-key toggle)
13. Analytics card AI usage

### Fase 4 — PAYG polish & ops (1–2 hari)
14. Auto-fallback subscription→PAYG (Pro Max) + toggle per workspace
15. Expiry sweep job (kredit idle 12 bulan) di worker cron
16. Admin page: ringkasan pendapatan AI, usage per tier, margin per model
17. Docs: halaman pricing help + FAQ metering

**Estimasi total: 7–9 hari kerja efektif.**

---

## 5. Yang TIDAK masuk scope v1 (YAGNI)

- Proration / prorated upgrade mid-cycle
- Multi-model routing cerdas per prompt (rule sederhana: priority order yang ada)
- Batch pricing / committed-use discount enterprise (nanti via sales)
- Self-serve export invoice AI (admin bisa dari audit)
- Kustom model / fine-tune hosting

---

## 6. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Biaya upstream > harga jual (margin negatif) | Margin calculator di admin; alert jika blended cost per credit > 60% harga; harga di catalog (bukan hardcode) sehingga mudah disesuaikan |
| Abuse (spam generation) | Rate limit per workspace + kuota itu sendiri adalah cap alami; monitor p99 usage per akun |
| Provider gateway down | Router fallback multi-provider yang sudah ada; status page entry |
| User kebingungan 2 sistem plan (sosial + AI) | Copy jelas: plan sosial = infra (send/publish), AI = add-on terpisah; ilustrasi di pricing page |
| Refund/chargeback kredit | Ledger `refund` meng-cleanup; PAYG terpakai sebelum refund → potong dari refund (kebijakan ditulis di ToS) |

---

## 7. Keputusan owner (locked 2026-08-27)

1. **Harga** — Starter Rp 50.000 / Pro Rp 150.000 / Pro Max Rp 250.000 per bulan; langganan 12 bulan diskon 10%.
2. **Fallback saat habis** — semua tier berhenti (fail-closed), hanya Pro Max auto-lanjut ke PAYG.
3. **Tanpa proration v1** — upgrade tier berlaku periode berikutnya.
4. **Model premium Pro Max** — owner menyiapkan base URL + daftar model 9Router; allowlist dikonfigurasi via env (`KOMENIN_AI_MODELS_PRO_MAX` dst.) sehingga tidak perlu deploy ulang saat daftar berubah.
5. **Kredit idle hangus 12 bulan** — disetujui, masuk ToS.

---

*Spec ini mengikuti pola superpowers: setelah disetujui, dipecah menjadi plan task-by-task di `docs/superpowers/plans/` dan diimplementasikan TDD per fase.*
