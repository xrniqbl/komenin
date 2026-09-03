import docsId from "@/data/docs-id.json";
import type { Locale } from "@/lib/i18n/messages";

export type DocsNavItem = {
  href: string;
  title: string;
};

export type DocsNavGroup = {
  title: string;
  items: DocsNavItem[];
};

export type DocsSection = {
  id: string;
  title: string;
  body?: string;
  bullets?: string[];
  steps?: string[];
  code?: string;
};

export type DocsPage = {
  slug: string;
  title: string;
  description: string;
  sections: DocsSection[];
};

export const docsNav: DocsNavGroup[] = [
  {
    title: "Getting Started",
    items: [
      { href: "/docs/tutorial/introduction", title: "Introduction" },
      { href: "/docs/tutorial/quick-start", title: "Quick Start" },
      { href: "/docs/tutorial/concepts", title: "Core Concepts" },
      { href: "/docs/tutorial/pricing-plans", title: "Pricing & Plans" },
    ],
  },
  {
    title: "Workspace Setup",
    items: [
      { href: "/docs/tutorial/accounts-proxies", title: "Accounts & Proxies" },
      { href: "/docs/tutorial/sessions", title: "Session Routing" },
      { href: "/docs/tutorial/connectors", title: "Connectors (Simulator / Webhook / Official)" },
    ],
  },
  {
    title: "Automation",
    items: [
      { href: "/docs/tutorial/campaigns", title: "Comment Campaigns" },
      { href: "/docs/tutorial/approvals", title: "Approvals Inbox" },
      { href: "/docs/tutorial/content", title: "Auto Post Campaigns" },
      { href: "/docs/tutorial/workers", title: "Workers & Jobs" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { href: "/docs/tutorial/agents", title: "Agents & Knowledge" },
      { href: "/docs/tutorial/skills", title: "Skills & CoT Runs" },
      { href: "/docs/tutorial/ai-gateway", title: "AI Gateway / 9Router" },
    ],
  },
  {
    title: "Enterprise",
    items: [
      { href: "/docs/tutorial/billing", title: "Billing & Midtrans" },
      { href: "/docs/tutorial/komenin-ai", title: "Komenin AI (Credits & Tiers)" },
      { href: "/docs/tutorial/sso", title: "SSO / SAML" },
      { href: "/docs/tutorial/admin", title: "Admin Panel" },
      { href: "/docs/tutorial/security", title: "Security & Audit" },
    ],
  },
  {
    title: "App Walkthroughs",
    items: [
      { href: "/docs/tutorial/command-center", title: "Command Center" },
      { href: "/docs/tutorial/inbox-activity", title: "Inbox & Activity" },
      { href: "/docs/tutorial/settings-map", title: "Settings Map" },
      { href: "/docs/tutorial/golden-path", title: "Golden Path Demo" },
    ],
  },
  {
    title: "Troubleshooting",
    items: [
      { href: "/docs/tutorial/troubleshooting", title: "Overview" },
      { href: "/docs/tutorial/troubleshoot-auth", title: "Auth & Workspace" },
      { href: "/docs/tutorial/troubleshoot-workers", title: "Workers & Jobs" },
      { href: "/docs/tutorial/troubleshoot-connectors", title: "Connectors & Live Mode" },
      { href: "/docs/tutorial/troubleshoot-approvals", title: "Approvals & Empty Inbox" },
      { href: "/docs/tutorial/troubleshoot-billing", title: "Billing & Vouchers" },
      { href: "/docs/tutorial/faq", title: "FAQ" },
    ],
  },
  {
    title: "Reference",
    items: [
      { href: "/docs/api", title: "API Reference" },
      { href: "/docs/api/public-v1", title: "Public API v1" },
      { href: "/docs/api/worker", title: "Worker API" },
      { href: "/docs/api/billing", title: "Billing Webhooks" },
      { href: "/docs/api/publish-webhook", title: "Publish Webhook" },
    ],
  },
];

export const docsPages: Record<string, DocsPage> = {
  introduction: {
    slug: "introduction",
    title: "Introduction",
    description:
      "Komenin is an enterprise social operations control plane for Instagram, Threads, and TikTok.",
    sections: [
      {
        id: "what-is-komenin",
        title: "What is Komenin?",
        body:
          "Komenin is a single workspace for social engagement operations. Instead of jumping between native apps just to review comments, approve drafts, rotate sessions, or publish content, operators manage everything from one control plane with auditability and guardrails.",
      },
      {
        id: "what-you-can-do",
        title: "What you can do",
        bullets: [
          "See accounts, sessions, campaigns, approvals, and activity in one place.",
          "Generate contextual comment drafts with hybrid AI (gateway + local fallback).",
          "Approve, edit, and pace outbound actions before they go live.",
          "Run auto-post campaigns on fixed intervals with schedule visibility.",
          "Use simulator mode for demos/CI, then switch to webhook or official connectors for live.",
          "Export audit logs and enforce monthly usage limits.",
        ],
      },
      {
        id: "who-it-is-for",
        title: "Who is it for?",
        bullets: [
          "Growth and social ops teams that need controlled automation.",
          "Agencies managing multiple brand accounts with approvals.",
          "Enterprise operators who need RBAC, audit trails, and security review support.",
        ],
      },
      {
        id: "two-ways",
        title: "Two ways to use Komenin",
        body:
          "Follow the Tutorial to operate everything from the dashboard, or use the API Reference to trigger workers, receive publish webhooks, and integrate billing notifications into your own stack.",
      },
    ],
  },
  "quick-start": {
    slug: "quick-start",
    title: "Quick Start",
    description: "Go from zero to a working simulator demo in one sitting.",
    sections: [
      {
        id: "prereqs",
        title: "Prerequisites",
        bullets: [
          "Node.js 20+",
          "Neon Postgres database URL",
          "Google OAuth web client",
          "64-hex ENCRYPTION_KEY",
        ],
      },
      {
        id: "install",
        title: "Install and boot",
        code: `npm install
npx prisma generate
npx prisma db push
npm run dev`,
      },
      {
        id: "first-path",
        title: "First operator path",
        bullets: [
          "Open /signup (or /login) and authenticate with Google — or use Email OTP: enter your email, then the 6-digit code sent via Brevo.",
          "Create a workspace in /onboarding.",
          "Add a proxy and social account under Session Routing.",
          "Create a comment campaign + listener.",
          "Run npm run worker:tick.",
          "Review drafts in /app/approvals, then inspect /app/activity.",
        ],
      },
      {
        id: "live-switch",
        title: "Switching toward live",
        body:
          "Keep SIMULATOR_MODE=true until the approval flow is trusted. Then set SIMULATOR_MODE=false, configure SOCIAL_PUBLISH_WEBHOOK_URL (and optional official API tokens), and test from /app/settings/publisher.",
      },
      {
        id: "checklist",
        title: "Operator checklist",
        steps: [
          "Confirm .env.local has DATABASE_URL, AUTH_*, ENCRYPTION_KEY, WORKER_SECRET.",
          "Run prisma generate + db push, then npm run dev.",
          "Sign up with Google and create a workspace.",
          "Add proxy + social account, then create a campaign/listener.",
          "Run worker:tick and review /app/approvals + /app/activity.",
          "Only then flip SIMULATOR_MODE=false for live connectors.",
        ],
      },
    ],
  },
  concepts: {
    slug: "concepts",
    title: "Core Concepts",
    description: "The building blocks you will see across the product.",
    sections: [
      {
        id: "workspace",
        title: "Workspace",
        body:
          "Every business object is scoped to a workspace. Memberships define role permissions (owner, admin, operator, analyst, auditor, viewer).",
      },
      {
        id: "session-routing",
        title: "Session Routing",
        body:
          "Accounts, encrypted session vaults, proxies, health checks, and rotation logs. This is the foundation for safe multi-account operations.",
      },
      {
        id: "comment-engine",
        title: "Comment Engine",
        body:
          "Listeners discover target posts, agents generate drafts, approvals gate sending, and workers execute paced outbound actions.",
      },
      {
        id: "connectors",
        title: "Connector plane",
        body:
          "Hybrid routing chooses simulator, webhook, or official adapters per action. Live mode fails closed when credentials are missing.",
      },
      {
        id: "intelligence",
        title: "Agents, knowledge, skills",
        body:
          "Agents carry persona/guardrails. Knowledge documents are chunked and retrieved into generation. Skills can inject tool results with chain-of-thought steps.",
      },
    ],
  },
  "pricing-plans": {
    slug: "pricing-plans",
    title: "Pricing & Plans",
    description: "Self-serve plans and enterprise overrides.",
    sections: [
      {
        id: "self-serve",
        title: "Self-serve plans",
        bullets: [
          "1 Month: flexible pilot runway.",
          "6 Months: best balance for growing operator teams.",
          "12 Months: lowest monthly rate for stable production.",
        ],
      },
      {
        id: "checkout",
        title: "Checkout",
        body:
          "Checkout uses Midtrans Snap with optional vouchers. Orders activate plan limits after settlement (or local simulation when Midtrans keys are absent).",
      },
      {
        id: "enterprise",
        title: "Enterprise",
        body:
          "Custom quotas, security review support, SSO, and guided onboarding are available via /enterprise and sales contact flows.",
      },
    ],
  },
  "accounts-proxies": {
    slug: "accounts-proxies",
    title: "Accounts & Proxies",
    description: "Connect social account records and bind healthy egress.",
    sections: [
      {
        id: "accounts",
        title: "Social accounts",
        body:
          "Create account records for Instagram, Threads, or TikTok. Status and health score update from worker probes.",
      },
      {
        id: "proxies",
        title: "Proxies",
        body:
          "Add proxy endpoints, assign them to accounts, and track rotation/health. Sticky vs rotate modes are supported in the data model.",
      },
      {
        id: "secrets",
        title: "Secrets",
        body:
          "Session blobs and sensitive values are encrypted with ENCRYPTION_KEY. Never store plaintext credentials in notes fields.",
      },
    ],
  },
  sessions: {
    slug: "sessions",
    title: "Session Routing",
    description: "Health, rotation, and operational visibility.",
    sections: [
      {
        id: "health",
        title: "Health checks",
        body:
          "Worker job session.health_check probes active sessions and proxy health, writes SessionHealthCheck rows, and can emit notifications on degradation.",
      },
      {
        id: "rotation",
        title: "Proxy rotation",
        body:
          "proxy.rotate advances IPs for non-sticky assignments and records IpRotationLog entries for auditability.",
      },
    ],
  },
  connectors: {
    slug: "connectors",
    title: "Connectors",
    description: "Simulator, webhook, and official native adapters.",
    sections: [
      {
        id: "policy",
        title: "Connector policy",
        bullets: [
          "prefer_webhook (default live)",
          "prefer_official",
          "webhook_only",
          "official_only",
          "simulator_only",
        ],
      },
      {
        id: "runtime",
        title: "Runtime mode",
        body:
          "SIMULATOR_MODE=true forces safe synthetic behavior. SIMULATOR_MODE=false uses live connectors and fails closed without configuration.",
      },
      {
        id: "publisher-settings",
        title: "Publisher settings",
        body:
          "Use /app/settings/publisher to inspect mode/policy, test webhook delivery, and review recent deliveries.",
      },
    ],
  },
  campaigns: {
    slug: "campaigns",
    title: "Comment Campaigns",
    description: "Discover posts, generate drafts, approve, and send.",
    sections: [
      {
        id: "create",
        title: "Create a campaign",
        body:
          "Define platform, mode (default approval_required), delays, daily limits, agent, and linked accounts. Attach listeners for keyword/competitor discovery.",
      },
      {
        id: "pipeline",
        title: "Pipeline",
        bullets: [
          "listener.poll discovers target posts",
          "comment.generate creates drafts + pending approvals",
          "operators edit/approve/reject",
          "comment.send executes due actions through connector router",
        ],
      },
      {
        id: "operator-steps",
        title: "Step-by-step",
        steps: [
          "Go to /app/campaigns and create a campaign in approval_required mode.",
          "Attach healthy accounts and set delay/daily limits.",
          "Create a listener with keyword or competitor query.",
          "Run listener.poll + comment.generate (or worker:tick).",
          "Open /app/approvals, edit if needed, approve selected drafts.",
          "Run comment.send and verify /app/activity + delivery logs.",
        ],
      },
    ],
  },
  approvals: {
    slug: "approvals",
    title: "Approvals Inbox",
    description: "Human control before outbound actions.",
    sections: [
      {
        id: "review",
        title: "Review flow",
        body:
          "Open /app/approvals to inspect draft text, risk flags, knowledge/skill markers, and decide approve/reject. Approved items schedule paced sends.",
      },
      {
        id: "defaults",
        title: "Safety defaults",
        body:
          "Approval-required is the default campaign mode. High-risk skills can force approval even when campaigns are set to auto.",
      },
    ],
  },
  content: {
    slug: "content",
    title: "Auto Post Campaigns",
    description: "Generate original posts and publish on an interval.",
    sections: [
      {
        id: "create-content",
        title: "Create content campaign",
        body:
          "Provide topic, platform, post count, interval, start time, and optional agent/account. Drafts can require approval before scheduling.",
      },
      {
        id: "publish",
        title: "Publish path",
        body:
          "content.generate creates drafts; content.publish sends due scheduled posts through the hybrid publisher connector and records delivery logs.",
      },
      {
        id: "content-steps",
        title: "Step-by-step",
        steps: [
          "Open /app/content/new and define topic, platform, interval, and post count.",
          "Generate drafts (approval mode recommended).",
          "Review and approve pending content drafts.",
          "Confirm schedule in the content calendar.",
          "Run content.publish or worker:tick for due posts.",
          "Inspect publisher deliveries under /app/settings/publisher.",
        ],
      },
    ],
  },
  workers: {
    slug: "workers",
    title: "Workers & Jobs",
    description: "Background execution for health, discovery, generation, and send/publish.",
    sections: [
      {
        id: "jobs",
        title: "Available jobs",
        bullets: [
          "session.health_check",
          "proxy.rotate",
          "listener.poll",
          "comment.generate / comment.send",
          "content.generate / content.publish",
          "knowledge.ingest",
          "skill.execute",
          "usage.rollup",
          "notify.dispatch",
          "worker.tick",
        ],
      },
      {
        id: "run",
        title: "How to run",
        code: `npm run worker:tick
# or
curl -X POST http://localhost:3000/api/worker/run ^
  -H "Authorization: Bearer %WORKER_SECRET%" ^
  -H "Content-Type: application/json" ^
  -d "{\\"job\\":\\"worker.tick\\"}"`,
      },
    ],
  },
  agents: {
    slug: "agents",
    title: "Agents & Knowledge",
    description: "Personas, memory, and grounded generation.",
    sections: [
      {
        id: "agents-ui",
        title: "Agents UI",
        body:
          "Create/edit personas under /app/agents. Each agent has tone, language, system prompt, knowledge docs, memory entries, and a playground.",
      },
      {
        id: "knowledge",
        title: "Knowledge ingest",
        body:
          "Upload text knowledge, then run knowledge.ingest to chunk content. Retrieval ranks chunks into comment generation context.",
      },
    ],
  },
  skills: {
    slug: "skills",
    title: "Skills & CoT Runs",
    description: "Tool execution with visible reasoning steps.",
    sections: [
      {
        id: "builtins",
        title: "Builtin skills",
        bullets: [
          "coupon-lookup",
          "brand-faq",
          "Custom webhook skills with schema/config",
        ],
      },
      {
        id: "runs",
        title: "Runs timeline",
        body:
          "Inspect /app/runs for step-level chain-of-thought. High-risk skills can force approval even in auto campaigns.",
      },
    ],
  },
  "ai-gateway": {
    slug: "ai-gateway",
    title: "AI Gateway / 9Router",
    description: "Hybrid generation with tiered fallback.",
    sections: [
      {
        id: "routing",
        title: "Routing model",
        body:
          "Campaign/Agent -> Komenin AI Router -> OpenAI-compatible gateway (e.g. 9Router) -> local rule-based fallback.",
      },
      {
        id: "env",
        title: "Key env vars",
        bullets: [
          "AI_GATEWAY_ENABLED",
          "AI_GATEWAY_BASE_URL",
          "AI_GATEWAY_API_KEY",
          "AI_MODEL_PRIMARY",
          "AI_MODEL_FALLBACKS",
          "AI_PROVIDERS (optional multi-tier JSON)",
        ],
      },
    ],
  },

  billing: {
    slug: "billing",
    title: "Billing & Midtrans",
    description: "Snap checkout, vouchers, and subscription activation.",
    sections: [
      {
        id: "checkout",
        title: "Checkout flow",
        bullets: [
          "Choose plan at /app/checkout",
          "Optional voucher validation",
          "Create Midtrans Snap transaction",
          "Notification webhook verifies signature and activates plan limits",
        ],
      },
      {
        id: "ai-addons",
        title: "Komenin AI add-ons",
        body:
          "Besides social plans, checkout also sells Komenin AI SKUs: 6 subscription tiers (Starter/Pro/Pro Max, monthly or 12-month) and 3 PAYG credit packs. Paid AI orders activate a subscription quota or grant credits automatically via the same Midtrans webhook. See the Komenin AI page for details.",
      },
      {
        id: "simulation",
        title: "Local simulation",
        body:
          "Without MIDTRANS_SERVER_KEY, checkout uses simulation tokens and can mark orders paid via /app/checkout/result for development.",
      },
      {
        id: "billing-steps",
        title: "Step-by-step",
        steps: [
          "Open /app/checkout and choose 1 / 6 / 12 month plan.",
          "Optionally apply a voucher code.",
          "Complete Midtrans Snap (or local simulation without keys).",
          "Confirm subscription status in /app/settings/billing.",
          "Verify monthly send/publish limits updated for the workspace.",
        ],
      },
    ],
  },
  "komenin-ai": {
    slug: "komenin-ai",
    title: "Komenin AI (Credits & Tiers)",
    description: "Use AI without your own API key — subscriptions, PAYG credits, and BYOK.",
    sections: [
      {
        id: "overview",
        title: "How it works",
        body:
          "Every workspace can use AI three ways, in priority order: (1) bring your own API key (BYOK, always free), (2) a Komenin AI monthly subscription with a credit quota, or (3) pay-as-you-go (PAYG) prepaid credits. 1 credit = 1 token (input + output), counted from the model's usage report.",
      },
      {
        id: "tiers",
        title: "Subscription tiers",
        bullets: [
          "AI Starter — Rp50.000/bln · 1.000.000 kredit/bln · model ekonomis",
          "AI Pro — Rp150.000/bln · 5.000.000 kredit/bln · model standar + priority queue",
          "AI Pro Max — Rp250.000/bln · 25.000.000 kredit/bln · semua model premium + auto-lanjut PAYG",
          "Komitmen 12 bulan: diskon 10% per bulan pada semua tier",
        ],
      },
      {
        id: "payg",
        title: "Pay-as-you-go credits",
        bullets: [
          "PAYG-S — Rp50.000 · 750.000 kredit",
          "PAYG-M — Rp150.000 · 2.500.000 kredit (bonus 5%)",
          "PAYG-L — Rp500.000 · 9.000.000 kredit (bonus 15%)",
          "Kredit berlaku 12 bulan selama akun aktif, dipakai setelah kuota langganan habis",
        ],
      },
      {
        id: "quota",
        title: "When the quota runs out",
        body:
          "Starter and Pro stop (fail-closed) until the next month or you buy PAYG credits — in-progress comment/content work is paused and you get a notification. Pro Max automatically continues on your PAYG balance (you can disable this in Settings → AI). Workspaces are also notified at 80% and 100% of the monthly quota.",
      },
      {
        id: "byok",
        title: "Bring your own key (BYOK)",
        body:
          "BYOK stays free forever. Add your OpenAI/Anthropic/9Router key in Settings → AI and enable 'prefer my own key' — AI calls then use your provider and never touch Komenin credits. Your keys are encrypted at rest.",
      },
      {
        id: "manage",
        title: "Manage & monitor",
        steps: [
          "Open Settings → AI to see your tier, monthly quota meter, and PAYG balance.",
          "Toggle 'prefer my own key' (BYOK) or Pro Max 'auto-fallback to PAYG'.",
          "Buy a subscription or PAYG pack from the checkout grid (Midtrans).",
          "Track usage per source and top models on the Analytics page.",
        ],
      },
    ],
  },
  sso: {
    slug: "sso",
    title: "SSO / SAML",
    description: "Enterprise identity for workspace access.",
    sections: [
      {
        id: "configure",
        title: "Configure",
        body:
          "Workspace admins set issuer, entry point, certificate, and email domain under /app/settings/security. Optional ssoRequired enforces SSO policy.",
      },
      {
        id: "endpoints",
        title: "Endpoints",
        bullets: [
          "/api/auth/sso/saml/login?email=user@domain.com",
          "/api/auth/sso/saml/acs",
        ],
      },
    ],
  },
  admin: {
    slug: "admin",
    title: "Admin Panel",
    description: "Platform superadmin console.",
    sections: [
      {
        id: "access",
        title: "Access",
        body:
          "Users with platformRole=superadmin can open /admin for workspaces, users, billing, vouchers, connectors, jobs, SSO, regions, flags, and audit.",
      },
      {
        id: "promote",
        title: "Promote a superadmin",
        code: `UPDATE "User" SET "platformRole" = 'superadmin' WHERE email = 'you@example.com';`,
      },
    ],
  },
  security: {
    slug: "security",
    title: "Security & Audit",
    description: "Guardrails that keep automation controllable.",
    sections: [
      {
        id: "controls",
        title: "Controls",
        bullets: [
          "Encrypted secrets at rest",
          "Workspace isolation on queries",
          "Approval-first defaults",
          "Usage limits on send/publish",
          "Append-only audit logs + CSV export",
        ],
      },
      {
        id: "compliance-stance",
        title: "Compliance stance",
        body:
          "Komenin is positioned as managed social engagement operations with guardrails, not a spam farm or ToS-bypass toolkit.",
      },
    ],
  },
  "command-center": {
    slug: "command-center",
    title: "Command Center Walkthrough",
    description: "How to read /app as an operator dashboard, not just a landing route.",
    sections: [
      {
        id: "open",
        title: "Open the command center",
        steps: [
          "Sign in and open /app.",
          "Confirm the active workspace in the shell.",
          "Scan cards/widgets for health, pending approvals, and recent activity.",
        ],
      },
      {
        id: "what-to-check",
        title: "Daily operator checklist",
        bullets: [
          "Degraded accounts or unhealthy proxies",
          "Pending approvals count",
          "Failed sends/publishes in recent activity",
          "Unread notifications",
        ],
      },
      {
        id: "next-actions",
        title: "Typical next clicks",
        bullets: [
          "/app/approvals for draft review",
          "/app/accounts when health drops",
          "/app/content for due auto posts",
          "/app/settings/publisher for connector issues",
        ],
      },
    ],
  },
  "inbox-activity": {
    slug: "inbox-activity",
    title: "Inbox & Activity Walkthrough",
    description: "Follow discovered posts and outbound outcomes end-to-end.",
    sections: [
      {
        id: "inbox",
        title: "Inbox",
        body: "Inbox lists discovered target posts and the latest generated draft state.",
        steps: [
          "Run a listener poll so new target posts appear.",
          "Open /app/inbox and inspect author/platform/content.",
          "If a draft exists, note status (pending/approved/sent).",
          "Jump to Approvals when draft review is required.",
        ],
      },
      {
        id: "activity",
        title: "Activity",
        body: "Activity is the operator-facing trail of campaign actions and send outcomes.",
        steps: [
          "Open /app/activity after approve/send cycles.",
          "Confirm scheduled vs sent vs failed states.",
          "Use failed rows to debug connector/policy/limit issues.",
        ],
      },
    ],
  },
  "settings-map": {
    slug: "settings-map",
    title: "Settings Map",
    description: "Where each operational control lives.",
    sections: [
      {
        id: "map",
        title: "Settings routes",
        bullets: [
          "/app/settings/general - workspace basics",
          "/app/settings/team - members and invites",
          "/app/settings/ai - hybrid AI gateway",
          "/app/settings/publisher - connector policy + webhook test",
          "/app/settings/billing - plan, usage, orders",
          "/app/settings/security - SSO/SAML + region",
        ],
      },
      {
        id: "when",
        title: "When to use which page",
        steps: [
          "AI quality issues -> /app/settings/ai and agent knowledge.",
          "Live publish/send failures -> /app/settings/publisher.",
          "Limit errors -> /app/settings/billing.",
          "Enterprise login policy -> /app/settings/security.",
        ],
      },
    ],
  },
  "golden-path": {
    slug: "golden-path",
    title: "Golden Path Demo",
    description: "A complete simulator demo path from signup to audited send.",
    sections: [
      {
        id: "goal",
        title: "Goal",
        body: "Prove the full control-plane loop in simulator mode before enabling live connectors.",
      },
      {
        id: "path",
        title: "Run this path",
        steps: [
          "Google signup -> create workspace.",
          "Add proxy + social account + active session record.",
          "Create agent and upload one knowledge doc; run knowledge.ingest.",
          "Create approval-required campaign + listener.",
          "Run worker:tick (health, poll, generate).",
          "Review drafts/skills, edit if needed, approve.",
          "Run comment.send and verify activity + audit log.",
          "Create one content campaign, approve drafts, publish due posts.",
          "Optional: open /app/checkout and simulate billing activation.",
        ],
      },
      {
        id: "pass-criteria",
        title: "Pass criteria",
        bullets: [
          "Approvals show editable drafts",
          "Activity shows sent/published outcomes",
          "Audit log captures sensitive actions",
          "No live external calls while SIMULATOR_MODE=true",
        ],
      },
    ],
  },

  troubleshooting: {
    slug: "troubleshooting",
    title: "Troubleshooting Overview",
    description: "Start here when something looks wrong in simulator or live mode.",
    sections: [
      {
        id: "triage",
        title: "Triage order",
        steps: [
          "Confirm runtime mode: SIMULATOR_MODE true/false.",
          "Confirm you are in the correct workspace.",
          "Check /app/notifications and /app/activity for recent failures.",
          "Check /app/settings/publisher for connector policy and webhook health.",
          "Re-run the smallest worker job that reproduces the issue (not always worker.tick).",
        ],
      },
      {
        id: "common",
        title: "Most common symptoms",
        bullets: [
          "Login loops or missing workspace after Google auth",
          "Worker returns 401 Unauthorized",
          "Inbox stays empty after poll",
          "Approvals empty after generate",
          "Live send/publish fails closed",
          "Webhook test fails / 401 token mismatch",
          "Voucher invalid or order stuck pending",
        ],
      },
      {
        id: "where",
        title: "Where to look",
        bullets: [
          "Auth/workspace issues -> Auth & Workspace page",
          "Job failures -> Workers & Jobs page",
          "Live delivery issues -> Connectors & Live Mode page",
          "Draft pipeline issues -> Approvals & Empty Inbox page",
          "Checkout issues -> Billing & Vouchers page",
        ],
      },
    ],
  },
  "troubleshoot-auth": {
    slug: "troubleshoot-auth",
    title: "Auth & Workspace Issues",
    description: "Fix Google login, onboarding, and membership access problems.",
    sections: [
      {
        id: "login-loop",
        title: "Login keeps returning to /login",
        steps: [
          "Verify AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET are set.",
          "Confirm Google OAuth redirect URI includes /api/auth/callback/google.",
          "Confirm APP_URL / AUTH_URL match the origin you open in browser.",
          "Clear site cookies for localhost and retry /signup.",
        ],
      },
      {
        id: "no-workspace",
        title: "Signed in but redirected to onboarding forever",
        steps: [
          "Complete workspace creation form (name required).",
          "Check database connectivity (DATABASE_URL) and prisma db push.",
          "Confirm Membership row exists for your user with status active.",
        ],
      },
      {
        id: "forbidden",
        title: "Forbidden on billing/settings actions",
        body: "RBAC blocks actions by role. Billing and some settings require elevated roles.",
        bullets: [
          "Owner: full access including billing",
          "Admin: broad manage permissions",
          "Operator: campaigns/accounts/agents",
          "Viewer/analyst/auditor: read-focused",
        ],
      },
      {
        id: "admin-access",
        title: "Cannot open /admin",
        steps: [
          "Ensure your user platformRole is superadmin.",
          "UPDATE User platformRole to superadmin for your email.",
          "Sign out/in and reopen /admin.",
        ],
      },
    ],
  },
  "troubleshoot-workers": {
    slug: "troubleshoot-workers",
    title: "Workers & Jobs Issues",
    description: "Debug worker auth, job names, and empty execution results.",
    sections: [
      {
        id: "unauthorized",
        title: "Worker API returns 401",
        steps: [
          "Set WORKER_SECRET in .env.local.",
          "Send Authorization: Bearer <WORKER_SECRET>.",
          "Restart dev server after env changes.",
        ],
        code: `curl -X POST http://localhost:3000/api/worker/run \n  -H "Authorization: Bearer $WORKER_SECRET" \n  -H "Content-Type: application/json" \n  -d '{"job":"session.health_check"}'`,
      },
      {
        id: "invalid-job",
        title: "Invalid job error",
        body: "Use only names exposed by GET /api/worker/run or npm run worker:* scripts.",
      },
      {
        id: "no-effect",
        title: "Job succeeds but UI looks unchanged",
        steps: [
          "Confirm the job message/count in JSON response.",
          "Hard refresh the related page (/app/inbox, /app/approvals, /app/activity).",
          "Ensure data belongs to the active workspace.",
          "For generate jobs, ensure there are target posts with status new.",
        ],
      },
      {
        id: "recommended",
        title: "Recommended debug sequence",
        steps: [
          "session.health_check",
          "listener.poll",
          "comment.generate",
          "comment.send (only after approvals exist)",
          "content.publish (only when drafts are scheduled/due)",
        ],
      },
    ],
  },
  "troubleshoot-connectors": {
    slug: "troubleshoot-connectors",
    title: "Connectors & Live Mode Issues",
    description: "Fix fail-closed live actions, webhook auth, and policy mismatches.",
    sections: [
      {
        id: "fail-closed",
        title: "Live mode fails with not configured",
        steps: [
          "Check SIMULATOR_MODE=false only when ready.",
          "Set SOCIAL_PUBLISH_WEBHOOK_URL or official API credentials.",
          "Confirm connector policy in /app/settings/publisher.",
          "Use Test webhook before enabling auto sends.",
        ],
      },
      {
        id: "webhook-401",
        title: "Publish webhook returns 401",
        steps: [
          "If SOCIAL_PUBLISH_WEBHOOK_TOKEN is set, sender must pass the same bearer token.",
          "If token is empty, receiver is open (dev only).",
          "Retest from /app/settings/publisher.",
        ],
      },
      {
        id: "official-fallback",
        title: "Official adapter fails and no fallback",
        body: "If policy is official_only, webhook fallback is disabled. Prefer prefer_official or prefer_webhook until native credentials are complete.",
      },
      {
        id: "simulator-confusion",
        title: "Still seeing simulator behavior",
        steps: [
          "Confirm process env actually loaded SIMULATOR_MODE=false (restart dev server).",
          "Check worker response mode field.",
          "Ensure one-off tests are not forcing simulator mode.",
        ],
      },
    ],
  },
  "troubleshoot-approvals": {
    slug: "troubleshoot-approvals",
    title: "Approvals & Empty Inbox",
    description: "Why drafts do not appear and how to recover the pipeline.",
    sections: [
      {
        id: "empty-inbox",
        title: "Inbox empty after poll",
        steps: [
          "Confirm at least one active listener exists.",
          "Run listener.poll and inspect job count.",
          "In live mode, discovery can fail closed if connector is misconfigured.",
          "In simulator mode, poll should create synthetic target posts.",
        ],
      },
      {
        id: "no-approvals",
        title: "No rows in /app/approvals",
        steps: [
          "Ensure target posts exist with status new.",
          "Run comment.generate.",
          "Confirm campaign/agent context is available.",
          "Refresh /app/approvals and /app/inbox.",
        ],
      },
      {
        id: "approved-not-sent",
        title: "Approved but not sent",
        steps: [
          "Check whether action is scheduled in the future (delay window).",
          "Run comment.send after scheduledFor is due.",
          "Inspect usage limits (monthly send limit).",
          "Inspect connector result message in activity/delivery logs.",
        ],
      },
    ],
  },
  "troubleshoot-billing": {
    slug: "troubleshoot-billing",
    title: "Billing & Voucher Issues",
    description: "Checkout, Snap, voucher validation, and pending orders.",
    sections: [
      {
        id: "voucher-invalid",
        title: "Voucher invalid",
        bullets: [
          "Code expired or not started",
          "Max redemptions reached",
          "Not allowed for selected plan",
          "Already redeemed by this workspace",
          "Below min subtotal",
        ],
      },
      {
        id: "snap",
        title: "Snap token/create fails",
        steps: [
          "If MIDTRANS_SERVER_KEY missing, app should use local simulation path.",
          "With keys present, verify sandbox vs production flags match the keys.",
          "Check server logs for Midtrans error messages.",
        ],
      },
      {
        id: "pending",
        title: "Order stuck pending",
        steps: [
          "Pending is normal for unpaid/unsettled transactions.",
          "Ensure notification endpoint is reachable by Midtrans.",
          "For local dev without Midtrans, use simulation result path to mark paid.",
          "Recheck /app/settings/billing order status after settlement.",
        ],
      },
    ],
  },

  faq: {
    slug: "faq",
    title: "FAQ",
    description: "Short answers to the questions operators and integrators ask most.",
    sections: [
      {
        id: "what-is-komenin",
        title: "What is Komenin?",
        body: "Komenin is an enterprise social operations control plane for Instagram, Threads, and TikTok. It centralizes accounts, approvals, automation, AI drafting, billing, and auditability.",
      },
      {
        id: "simulator-vs-live",
        title: "What is the difference between simulator and live mode?",
        body: "Simulator mode synthesizes discovery/send/publish results for safe demos and CI. Live mode uses webhook and/or official connectors and fails closed when credentials are missing.",
      },
      {
        id: "default-approval",
        title: "Are campaigns auto-send by default?",
        body: "No. Default campaign mode is approval_required so humans can edit/approve drafts before outbound actions.",
      },
      {
        id: "midtrans",
        title: "Do I need Midtrans keys for local development?",
        body: "No. Without MIDTRANS_SERVER_KEY, checkout uses a local simulation path so you can still validate plan activation UX.",
      },
      {
        id: "9router",
        title: "How does 9Router fit in?",
        body: "Komenin can call any OpenAI-compatible gateway. 9Router is the recommended hybrid gateway so provider keys stay outside Komenin while generation still has tiered fallback.",
      },
      {
        id: "worker-secret",
        title: "Why does the worker API return 401?",
        body: "POST /api/worker/run requires Authorization: Bearer WORKER_SECRET. Missing/mismatched secrets are rejected.",
      },
      {
        id: "empty-approvals",
        title: "Why is Approvals empty?",
        body: "Approvals appear after comment.generate creates drafts from target posts. If listeners never poll or generate never runs, the inbox/approvals stay empty.",
      },
      {
        id: "admin",
        title: "How do I access /admin?",
        body: "Only users with platformRole=superadmin can open the platform admin console. Promote your user in the database, then sign out/in.",
      },
      {
        id: "sso",
        title: "Is SSO required for all workspaces?",
        body: "No. SSO/SAML is optional per workspace. Enable and optionally force it under /app/settings/security.",
      },
      {
        id: "support-path",
        title: "Where do I go next if still blocked?",
        bullets: [
          "Start at /docs/tutorial/troubleshooting",
          "Use the symptom-specific troubleshooting pages",
          "Reproduce with the smallest worker job and capture the JSON response",
          "Check /app/activity, /app/settings/publisher, and audit logs",
        ],
      },
    ],
  },

};

export const apiPages: Record<string, DocsPage> = {
  index: {
    slug: "index",
    title: "API Reference",
    description: "HTTP endpoints for workers, billing, connector callbacks, and workspace API keys.",
    sections: [
      {
        id: "auth",
        title: "Authentication",
        body:
          "Browser session auth protects app routes/server actions. Workspace integrations use kmn_ API keys. Worker and some webhook endpoints use bearer secrets/tokens.",
      },
      {
        id: "groups",
        title: "Endpoint groups",
        bullets: [
          "Public API v1 (API keys)",
          "Worker run API",
          "Midtrans Snap + notification",
          "Voucher validation",
          "Publish webhook receiver",
          "SSO SAML bootstrap/ACS",
          "Contact form POST /api/contact",
        ],
      },
    ],
  },
  "public-v1": {
    slug: "public-v1",
    title: "Public API v1",
    description:
      "Workspace-scoped REST endpoints authenticated with kmn_ API keys from Settings → API keys.",
    sections: [
      {
        id: "auth",
        title: "Authentication",
        body:
          "Create a key under /app/settings/api-keys. Send it as x-api-key or Authorization: Bearer kmn_.... Write routes require the public_api_write feature flag (on by default) plus campaigns:write scope.",
        code: `curl https://your-app/api/v1/campaigns \\
  -H "Authorization: Bearer kmn_..."`,
      },
      {
        id: "scopes",
        title: "Scopes",
        bullets: [
          "campaigns:read / campaigns:write",
          "accounts:read",
          "listeners:read / listeners:write (listeners also accept campaigns:read/write)",
          "leads:read / leads:write",
          "activity:read",
          "analytics:read",
          "competitors:read",
          "templates:read",
        ],
      },
      {
        id: "list-campaigns",
        title: "GET /api/v1/campaigns",
        body: "List campaigns for the API key workspace.",
      },
      {
        id: "create-campaign",
        title: "POST /api/v1/campaigns",
        body: "Create a campaign. Optional listenerQuery creates a keyword listener. Optional socialAccountIds must belong to the workspace.",
        code: `{
  "name": "IG keyword pilot",
  "platform": "instagram",
  "mode": "approval_required",
  "goal": "Helpful product replies",
  "listenerQuery": "social ops automation",
  "clientId": "optional_client_profile_id",
  "dailyLimit": 30
}`,
      },
      {
        id: "listeners",
        title: "GET/POST /api/v1/listeners",
        body: "List or create keyword/competitor/trend listeners. POST requires campaigns:write.",
        code: `{
  "platform": "instagram",
  "type": "keyword",
  "query": "ai agent",
  "campaignId": "optional_campaign_id"
}`,
      },
      {
        id: "leads",
        title: "GET/POST /api/v1/leads",
        body:
          "List or create engagement leads. Query params for GET: status, clientId, q. Requires lead_capture feature flag. POST uses leads:write and fires outbound lead.captured with structured CRM fields on generic webhooks.",
        code: `{
  "handle": "prospect_ig",
  "platform": "instagram",
  "intent": "Asked for pricing",
  "contactEmail": "ops@brand.com",
  "clientId": "optional_client_id",
  "source": "api"
}`,
      },
      {
        id: "read-others",
        title: "Other read endpoints",
        bullets: [
          "GET /api/v1/accounts",
          "GET /api/v1/activity",
          "GET /api/v1/analytics",
        ],
      },
      {
        id: "outbound-webhooks",
        title: "Outbound workspace webhooks",
        body:
          "Configure Slack/Discord/generic endpoints under Settings → Webhooks. Events include approval.new, lead.captured (extra: handle/email/client/campaign/status), account.degraded, account.reauth_required, account.proxy_rotated, comment.failed, usage.warning.",
      },
    ],
  },
  worker: {
    slug: "worker",
    title: "Worker API",
    description: "Trigger background jobs over HTTP with bearer auth.",
    sections: [
      {
        id: "auth",
        title: "Authentication",
        body: "Send WORKER_SECRET as Authorization Bearer token (or x-worker-secret header).",
        code: `Authorization: Bearer <WORKER_SECRET>`,
      },
      {
        id: "list-jobs",
        title: "GET /api/worker/run",
        body: "List allowed job names and current runtime mode.",
        code: `{
  "jobs": ["worker.tick", "session.health_check", "..."],
  "mode": "simulator"
}`,
      },
      {
        id: "run",
        title: "POST /api/worker/run",
        body: "Execute one job. Invalid job names return 400; bad secrets return 401.",
        code: `curl -X POST http://localhost:3000/api/worker/run \
  -H "Authorization: Bearer $WORKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"job":"comment.generate"}'`,
      },
      {
        id: "request",
        title: "Request body",
        code: `{
  "job": "worker.tick"
}`,
      },
      {
        id: "response",
        title: "Success response",
        code: `{
  "ok": true,
  "job": "comment.generate",
  "message": "Generated 3 drafts",
  "count": 3,
  "details": null,
  "mode": "simulator"
}`,
      },
      {
        id: "jobs",
        title: "Job names",
        bullets: [
          "worker.tick",
          "session.health_check",
          "proxy.rotate",
          "listener.poll",
          "comment.generate",
          "comment.send",
          "content.generate",
          "content.publish",
          "knowledge.ingest",
          "skill.execute",
          "usage.rollup",
          "notify.dispatch",
        ],
      },
    ],
  },
  billing: {
    slug: "billing",
    title: "Billing Webhooks",
    description: "Midtrans Snap checkout, voucher validation, and settlement notifications.",
    sections: [
      {
        id: "snap",
        title: "POST /api/billing/midtrans/snap",
        body: "Creates a workspace order and returns Snap token/redirect URL.",
        code: `// request
{
  "planCode": "growth_6m",
  "voucherCode": "AETHER10"
}

// response
{
  "orderId": "clx...",
  "orderCode": "AETH-1710000000-123",
  "token": "snap-token-or-sim-token",
  "redirectUrl": "https://app.sandbox.midtrans.com/snap/v2/vtweb/...",
  "totalIdr": 2154600,
  "discountIdr": 239400,
  "subtotalIdr": 2394000,
  "clientKey": "SB-Mid-client-xxx",
  "isSimulation": false
}`,
      },
      {
        id: "notification",
        title: "POST /api/billing/midtrans/notification",
        body: "Midtrans server-to-server notification. Signature is verified when MIDTRANS_SERVER_KEY is set.",
        code: `// request
{
  "order_id": "AETH-1710000000-123",
  "status_code": "200",
  "gross_amount": "2154600.00",
  "signature_key": "<sha512>",
  "transaction_status": "settlement",
  "transaction_id": "midtrans-trx-id",
  "payment_type": "qris"
}

// response
{
  "ok": true,
  "result": {
    "ok": true,
    "orderId": "clx...",
    "subscriptionId": "clx..."
  }
}`,
      },
      {
        id: "voucher",
        title: "POST /api/billing/voucher/validate",
        body: "Validates a voucher for the selected plan before checkout.",
        code: `// request
{ "code": "AETHER10", "planCode": "growth_6m" }

// response
{
  "voucherId": "clx...",
  "code": "AETHER10",
  "type": "percent",
  "value": 10,
  "discountIdr": 239400,
  "totalIdr": 2154600
}`,
      },
    ],
  },
  "publish-webhook": {
    slug: "publish-webhook",
    title: "Publish Webhook",
    description: "Local/live receiver used by the hybrid publisher connector.",
    sections: [
      {
        id: "endpoint",
        title: "POST /api/publish/webhook",
        body: "Accepts publish payloads from Komenin live mode. Optional bearer token via SOCIAL_PUBLISH_WEBHOOK_TOKEN.",
        code: `curl -X POST http://localhost:3000/api/publish/webhook \
  -H "Authorization: Bearer $SOCIAL_PUBLISH_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "instagram",
    "username": "brand",
    "body": "We just shipped a safer approvals flow.",
    "hashtags": ["komenin", "socialops"]
  }'`,
      },
      {
        id: "response",
        title: "Response",
        code: `{
  "ok": true,
  "id": "dlv_...",
  "externalPostId": "hook_...",
  "message": "Webhook accepted"
}`,
      },
      {
        id: "ops",
        title: "Operator tips",
        bullets: [
          "Point SOCIAL_PUBLISH_WEBHOOK_URL at this receiver or your n8n/custom worker.",
          "Use /app/settings/publisher Test webhook before enabling live campaigns.",
          "Keep SIMULATOR_MODE=true until deliveries look correct.",
        ],
      },
    ],
  },
};


type LocalizedDocsBundle = {
  docsNav: DocsNavGroup[];
  docsPages: Record<string, DocsPage>;
  apiPages: Record<string, DocsPage>;
};

const docsIdBundle = docsId as LocalizedDocsBundle;

function getDocsBundle(locale: Locale = "en"): LocalizedDocsBundle {
  if (locale === "id") return docsIdBundle;
  return {
    docsNav,
    docsPages,
    apiPages,
  };
}

export function getDocsNav(locale: Locale = "en"): DocsNavGroup[] {
  return getDocsBundle(locale).docsNav;
}

export function getDocsPage(slug: string, locale: Locale = "en"): DocsPage | null {
  return getDocsBundle(locale).docsPages[slug] || null;
}

export function getApiPage(slug: string, locale: Locale = "en"): DocsPage | null {
  const pages = getDocsBundle(locale).apiPages;
  if (slug === "index" || slug === "") return pages.index;
  return pages[slug] || null;
}

export function getAllTutorialSlugs(): string[] {
  return Object.keys(docsPages);
}

export type DocsSearchItem = {
  href: string;
  title: string;
  description: string;
  group: string;
};

export function getFlatDocsNav(locale: Locale = "en"): DocsNavItem[] {
  return getDocsNav(locale).flatMap((group) => group.items);
}

export function getDocsNeighbors(
  href: string,
  locale: Locale = "en",
): {
  prev: DocsNavItem | null;
  next: DocsNavItem | null;
} {
  const flat = getFlatDocsNav(locale);
  const index = flat.findIndex((item) => item.href === href);
  if (index < 0) return { prev: null, next: null };
  return {
    prev: index > 0 ? flat[index - 1] : null,
    next: index < flat.length - 1 ? flat[index + 1] : null,
  };
}

export function getDocsSearchIndex(locale: Locale = "en"): DocsSearchItem[] {
  const items: DocsSearchItem[] = [];
  const bundle = getDocsBundle(locale);

  for (const group of bundle.docsNav) {
    for (const item of group.items) {
      let description = item.title;
      if (item.href.startsWith("/docs/tutorial/")) {
        const slug = item.href.replace("/docs/tutorial/", "");
        description = bundle.docsPages[slug]?.description || item.title;
      } else if (item.href === "/docs/api") {
        description = bundle.apiPages.index.description;
      } else if (item.href.startsWith("/docs/api/")) {
        const slug = item.href.replace("/docs/api/", "");
        description = bundle.apiPages[slug]?.description || item.title;
      }
      items.push({
        href: item.href,
        title: item.title,
        description,
        group: group.title,
      });
    }
  }

  return items;
}

