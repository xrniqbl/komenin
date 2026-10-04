import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Load TS docs via tsx runtime by dynamic import after tsx register from CLI.
const { docsNav, docsPages, apiPages } = await import("../src/data/docs.ts");

const exact = {
  Introduction: "Pendahuluan",
  "Quick Start": "Mulai Cepat",
  "Core Concepts": "Konsep Inti",
  "Pricing & Plans": "Harga & Paket",
  "Accounts & Proxies": "Akun & Proxy",
  "Session Routing": "Routing Sesi",
  "Comment Campaigns": "Kampanye Komentar",
  "Approvals Inbox": "Kotak Persetujuan",
  "Auto Post Campaigns": "Kampanye Auto Post",
  "Workers & Jobs": "Worker & Job",
  "Agents & Knowledge": "Agen & Knowledge",
  "Skills & CoT Runs": "Skill & Jalankan CoT",
  "AI Gateway / 9Router": "AI Gateway / 9Router",
  "Billing & Midtrans": "Billing & Midtrans",
  "SSO / SAML": "SSO / SAML",
  "Admin Panel": "Panel Admin",
  "Security & Audit": "Keamanan & Audit",
  "Command Center": "Command Center",
  "Inbox & Activity": "Inbox & Aktivitas",
  "Settings Map": "Peta Pengaturan",
  "Golden Path Demo": "Demo Golden Path",
  Troubleshooting: "Pemecahan Masalah",
  "Auth & Workspace": "Auth & Workspace",
  "Connectors & Live Mode": "Konektor & Mode Live",
  "Approvals & Empty Inbox": "Persetujuan & Inbox Kosong",
  "Billing & Vouchers": "Billing & Voucher",
  FAQ: "FAQ",
  "API Reference": "Referensi API",
  "Worker API": "API Worker",
  "Billing Webhooks": "Webhook Billing",
  "Publish Webhook": "Webhook Publish",
  Overview: "Ringkasan",
  "What is Komenin?": "Apa itu Komenin?",
  "What you can do": "Yang bisa Anda lakukan",
  "Who is it for?": "Untuk siapa?",
  "Two ways to use Komenin": "Dua cara memakai Komenin",
  Prerequisites: "Prasyarat",
};

const phrasePairs = [
  [
    "Komenin is an enterprise social operations control plane for Instagram, Threads, and TikTok.",
    "Komenin adalah control plane operasi sosial enterprise untuk Instagram, Threads, dan TikTok.",
  ],
  [
    "Komenin is a single workspace for social engagement operations. Instead of jumping between native apps just to review comments, approve drafts, rotate sessions, or publish content, operators manage everything from one control plane with auditability and guardrails.",
    "Komenin adalah satu workspace untuk operasi engagement sosial. Alih-alih berpindah antar aplikasi native hanya untuk meninjau komentar, menyetujui draf, merotasi sesi, atau mempublikasikan konten, operator mengelola semuanya dari satu control plane yang dapat diaudit dan ber-guardrail.",
  ],
  [
    "See accounts, sessions, campaigns, approvals, and activity in one place.",
    "Lihat akun, sesi, kampanye, persetujuan, dan aktivitas di satu tempat.",
  ],
  [
    "Generate contextual comment drafts with hybrid AI (gateway + local fallback).",
    "Hasilkan draf komentar kontekstual dengan AI hybrid (gateway + fallback lokal).",
  ],
  [
    "Approve, edit, and pace outbound actions before they go live.",
    "Setujui, edit, dan atur irama aksi outbound sebelum dipublikasikan.",
  ],
  [
    "Run auto-post campaigns on fixed intervals with schedule visibility.",
    "Jalankan kampanye auto-post pada interval tetap dengan visibilitas jadwal.",
  ],
  [
    "Use simulator mode for demos/CI, then switch to webhook or official connectors for live.",
    "Gunakan mode simulator untuk demo/CI, lalu beralih ke webhook atau konektor resmi untuk live.",
  ],
  [
    "Export audit logs and enforce monthly usage limits.",
    "Ekspor audit log dan terapkan batas penggunaan bulanan.",
  ],
  [
    "Growth and social ops teams that need controlled automation.",
    "Tim growth dan social ops yang butuh otomasi terkendali.",
  ],
  [
    "Agencies managing multiple brand accounts with approvals.",
    "Agensi yang mengelola banyak akun brand dengan alur persetujuan.",
  ],
  [
    "Enterprise operators who need RBAC, audit trails, and security review support.",
    "Operator enterprise yang butuh RBAC, jejak audit, dan dukungan review keamanan.",
  ],
  [
    "Follow the Tutorial to operate everything from the dashboard, or use the API Reference to trigger workers, receive publish webhooks, and integrate billing notifications into your own stack.",
    "Ikuti Tutorial untuk mengoperasikan semuanya dari dashboard, atau gunakan Referensi API untuk memicu worker, menerima webhook publish, dan mengintegrasikan notifikasi billing ke stack Anda sendiri.",
  ],
  [
    "Go from zero to a working simulator demo in one sitting.",
    "Dari nol hingga demo simulator yang berjalan dalam satu sesi.",
  ],
  ["Neon Postgres database URL", "URL database Neon Postgres"],
  ["Google OAuth web client", "Klien web Google OAuth"],
  ["64-hex ENCRYPTION_KEY", "ENCRYPTION_KEY 64 hex"],
  ["Node.js 20+", "Node.js 20+"],
];

const wordPairs = [
  [/\bcontrol plane\b/gi, "control plane"],
  [/\bsocial operations\b/gi, "operasi sosial"],
  [/\bsocial engagement\b/gi, "engagement sosial"],
  [/\bcomment drafts?\b/gi, "draf komentar"],
  [/\bauto[- ]?posts?\b/gi, "auto-post"],
  [/\bcampaigns?\b/gi, "kampanye"],
  [/\blisteners?\b/gi, "listener"],
  [/\bprox(?:y|ies)\b/gi, "proxy"],
  [/\bsessions?\b/gi, "sesi"],
  [/\baccounts?\b/gi, "akun"],
  [/\bapprovals?\b/gi, "persetujuan"],
  [/\bworkers?\b/gi, "worker"],
  [/\bwebhooks?\b/gi, "webhook"],
  [/\bconnectors?\b/gi, "konektor"],
  [/\bsimulator mode\b/gi, "mode simulator"],
  [/\blive mode\b/gi, "mode live"],
  [/\baudit logs?\b/gi, "audit log"],
  [/\bencrypted secrets?\b/gi, "rahasia terenkripsi"],
  [/\busage limits?\b/gi, "batas penggunaan"],
  [/\bmonthly\b/gi, "bulanan"],
  [/\bsettings?\b/gi, "pengaturan"],
  [/\bsecurity\b/gi, "keamanan"],
  [/\bvouchers?\b/gi, "voucher"],
  [/\brequired\b/gi, "wajib"],
  [/\boptional\b/gi, "opsional"],
  [/\bfailed\b/gi, "gagal"],
  [/\bsuccessful\b/gi, "berhasil"],
  [/\berrors?\b/gi, "error"],
  [/\bcreate\b/gi, "buat"],
  [/\bcreated\b/gi, "dibuat"],
  [/\bopen\b/gi, "buka"],
  [/\bclick\b/gi, "klik"],
  [/\bthen\b/gi, "lalu"],
  [/\byour\b/gi, "Anda"],
  [/\byou\b/gi, "Anda"],
];

function smartTranslate(text) {
  if (!text) return text;
  if (exact[text]) return exact[text];
  let out = text;
  for (const [from, to] of phrasePairs) {
    out = out.split(from).join(to);
  }
  for (const [from, to] of wordPairs) {
    out = out.replace(from, to);
  }
  // Light cleanup only; keep technical English tokens intact when mixed.
  return out.replace(/\s{2,}/g, " ").trim();
}

function translatePage(page) {
  return {
    ...page,
    title: smartTranslate(page.title),
    description: smartTranslate(page.description),
    sections: page.sections.map((section) => ({
      ...section,
      title: smartTranslate(section.title),
      body: section.body ? smartTranslate(section.body) : section.body,
      bullets: section.bullets?.map(smartTranslate),
      steps: section.steps?.map(smartTranslate),
      code: section.code,
    })),
  };
}

const navId = [
  {
    title: "Mulai",
    items: [
      { href: "/docs/tutorial/introduction", title: "Pendahuluan" },
      { href: "/docs/tutorial/quick-start", title: "Mulai Cepat" },
      { href: "/docs/tutorial/concepts", title: "Konsep Inti" },
      { href: "/docs/tutorial/pricing-plans", title: "Harga & Paket" },
    ],
  },
  {
    title: "Pengaturan Workspace",
    items: [
      { href: "/docs/tutorial/accounts-proxies", title: "Akun & Proxy" },
      { href: "/docs/tutorial/sessions", title: "Routing Sesi" },
      {
        href: "/docs/tutorial/connectors",
        title: "Konektor (Simulator / Webhook / Resmi)",
      },
    ],
  },
  {
    title: "Otomasi",
    items: [
      { href: "/docs/tutorial/campaigns", title: "Kampanye Komentar" },
      { href: "/docs/tutorial/approvals", title: "Kotak Persetujuan" },
      { href: "/docs/tutorial/content", title: "Kampanye Auto Post" },
      { href: "/docs/tutorial/workers", title: "Worker & Job" },
    ],
  },
  {
    title: "Inteligensi",
    items: [
      { href: "/docs/tutorial/agents", title: "Agen & Knowledge" },
      { href: "/docs/tutorial/skills", title: "Skill & Jalankan CoT" },
      { href: "/docs/tutorial/ai-gateway", title: "AI Gateway / 9Router" },
    ],
  },
  {
    title: "Enterprise",
    items: [
      { href: "/docs/tutorial/billing", title: "Billing & Midtrans" },
      { href: "/docs/tutorial/sso", title: "SSO / SAML" },
      { href: "/docs/tutorial/admin", title: "Panel Admin" },
      { href: "/docs/tutorial/security", title: "Keamanan & Audit" },
    ],
  },
  {
    title: "Panduan Aplikasi",
    items: [
      { href: "/docs/tutorial/command-center", title: "Command Center" },
      { href: "/docs/tutorial/inbox-activity", title: "Inbox & Aktivitas" },
      { href: "/docs/tutorial/settings-map", title: "Peta Pengaturan" },
      { href: "/docs/tutorial/golden-path", title: "Demo Golden Path" },
    ],
  },
  {
    title: "Pemecahan Masalah",
    items: [
      { href: "/docs/tutorial/troubleshooting", title: "Ringkasan" },
      { href: "/docs/tutorial/troubleshoot-auth", title: "Auth & Workspace" },
      { href: "/docs/tutorial/troubleshoot-workers", title: "Worker & Job" },
      {
        href: "/docs/tutorial/troubleshoot-connectors",
        title: "Konektor & Mode Live",
      },
      {
        href: "/docs/tutorial/troubleshoot-approvals",
        title: "Persetujuan & Inbox Kosong",
      },
      { href: "/docs/tutorial/troubleshoot-billing", title: "Billing & Voucher" },
      { href: "/docs/tutorial/faq", title: "FAQ" },
    ],
  },
  {
    title: "Referensi",
    items: [
      { href: "/docs/api", title: "Referensi API" },
      { href: "/docs/api/worker", title: "API Worker" },
      { href: "/docs/api/billing", title: "Webhook Billing" },
      { href: "/docs/api/publish-webhook", title: "Webhook Publish" },
    ],
  },
];

const docsPagesId = Object.fromEntries(
  Object.entries(docsPages).map(([slug, page]) => [slug, translatePage(page)]),
);
const apiPagesId = Object.fromEntries(
  Object.entries(apiPages).map(([slug, page]) => [slug, translatePage(page)]),
);

writeFileSync(
  "src/data/docs-id.json",
  JSON.stringify(
    { docsNav: navId, docsPages: docsPagesId, apiPages: apiPagesId },
    null,
    2,
  ),
);

console.log("wrote src/data/docs-id.json");
console.log("intro:", docsPagesId.introduction.title, "|", docsPagesId.introduction.description.slice(0, 90));
console.log("nav groups:", navId.length, "tutorial pages:", Object.keys(docsPagesId).length);
