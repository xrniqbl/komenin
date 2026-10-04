import { absoluteUrl, PUBLIC_ROUTES } from "@/lib/seo";

/**
 * llms.txt — machine-readable site summary for AI search crawlers and
 * assistants (ChatGPT, Claude, Gemini, Perplexity). Plain-text route so the
 * file is served as `text/plain; charset=utf-8` at /llms.txt.
 *
 * Keep this curated and short: positioning, audience, feature map, docs map,
 * pricing summary, and contact. Full page content lives on the linked URLs.
 *
 * Dynamic (not prerendered): absolute URLs resolve APP_URL at request time
 * so a build without the prod env can never bake localhost links in.
 */
export const dynamic = "force-dynamic";

function buildBody(): string {
  return `# Komenin — Enterprise Social Comment & Content Automation

> Komenin is an approval-first social media automation control plane for
> Instagram, Threads, and TikTok: session routing, auto comment engine
> (bot sosmed / bot auto komentar), AI reply agents, skill automations,
> content campaigns with scheduling, and full audit trails.

Primary audience: social media agencies and operations teams in Indonesia
running multiple accounts who need throughput with human approval control.
Indonesian variant available under /id/... paths (e.g. /id/pricing).

Keywords: automation sosial media, bot sosmed, campaign sosial media,
sosmed automation, otomatisasi komentar Instagram, auto posting TikTok,
Instagram comment automation, Threads automation, TikTok publishing.

## Core features

- Session routing & proxy pools: anti-detect sessions, residential/mobile/
  datacenter proxies, multi-tunnel account grid, health scoring.
  ${absoluteUrl("/features/session-routing")}
- Comment engine: keyword/competitor/trend listeners, AI drafts, human-like
  pacing, approval queues, per-platform rate limits.
  ${absoluteUrl("/features/comment-engine")}
- Agent intelligence: personas, guardrails, RAG knowledge, memory ledger,
  playground draft testing.
  ${absoluteUrl("/features/agent-intelligence")}
- Skill execution: intent-triggered skills, webhook executors, transparent
  execution timeline, high-risk approval guards.
  ${absoluteUrl("/features/skill-execution")}
- Features overview: ${absoluteUrl("/features")}

## Pricing

- Plans: 1, 6, and 12 month commitments (IDR, billed via Midtrans). Longer
  commitments unlock lower monthly rates. AI credits are a separate add-on;
  bringing your own API key stays free.
- Details: ${absoluteUrl("/pricing")}
- Signup: ${absoluteUrl("/signup")}

## Docs & API

- Documentation hub: ${absoluteUrl("/docs")}
- Tutorials: ${absoluteUrl("/docs/tutorial/introduction")}
- API reference: ${absoluteUrl("/docs/api")}
- Worker API: ${absoluteUrl("/docs/api/worker")}
- Billing API: ${absoluteUrl("/docs/api/billing")}
- Publish webhook: ${absoluteUrl("/docs/api/publish-webhook")}

## Trust

- Security model: ${absoluteUrl("/security")}
- Enterprise (RBAC, SSO, audit export): ${absoluteUrl("/enterprise")}
- Acceptable use: ${absoluteUrl("/legal/aup")}
- Privacy: ${absoluteUrl("/legal/privacy")}
- Terms: ${absoluteUrl("/legal/terms")}
- Live status: ${absoluteUrl("/status")}

## Site map (public)

${PUBLIC_ROUTES.map((route) => `- ${absoluteUrl(route.path)}`).join("\n")}

## Contact

- Sales / pilots / enterprise: ${absoluteUrl("/contact")}
- About: ${absoluteUrl("/about")}
`;
}

export function GET(): Response {
  return new Response(buildBody(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400",
    },
  });
}
