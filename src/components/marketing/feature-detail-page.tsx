"use client";

import { LocaleLink } from "@/components/i18n/locale-link";
import SmartToyIcon from '@mui/icons-material/SmartToyRounded';
import CableIcon from '@mui/icons-material/CableRounded';
import ScheduleIcon from '@mui/icons-material/ScheduleRounded';
import DescriptionIcon from '@mui/icons-material/DescriptionRounded';
import LanguageIcon from '@mui/icons-material/LanguageRounded';
import LayersIcon from '@mui/icons-material/LayersRounded';
import HubIcon from '@mui/icons-material/HubRounded';
import ShieldIcon from '@mui/icons-material/ShieldRounded';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesomeRounded';
import AccountTreeIcon from '@mui/icons-material/AccountTreeRounded';
import BoltIcon from '@mui/icons-material/BoltRounded';
import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AgentIntelligenceMock,
  CommentEngineMock,
  SessionRoutingMock,
  SkillExecutionMock,
} from "./feature-demo-mocks";

type FeatureDetailKey = "sessionRouting" | "commentEngine" | "agentIntelligence" | "skillExecution";

const KEY_ICONS: Record<FeatureDetailKey, typeof ShieldIcon> = {
  sessionRouting: HubIcon,
  commentEngine: AccountTreeIcon,
  agentIntelligence: SmartToyIcon,
  skillExecution: LayersIcon,
};

const KEY_STATS: Record<FeatureDetailKey, { label: string; value: string }[]> = {
  sessionRouting: [
    { label: "Proxy protocols", value: "HTTP / HTTPS / SOCKS5" },
    { label: "Account tunnels", value: "Up to 100" },
    { label: "Health signal", value: "<700ms probe" },
  ],
  commentEngine: [
    { label: "Discovery types", value: "Keyword / Competitor / Trend" },
    { label: "Approval modes", value: "Required / Auto" },
    { label: "Pacing range", value: "5s – 30m delay" },
  ],
  agentIntelligence: [
    { label: "Knowledge", value: "RAG + chunk ranking" },
    { label: "Memory", value: "Entity ledger" },
    { label: "Playground", value: "Instant draft test" },
  ],
  skillExecution: [
    { label: "Executors", value: "Builtin / Webhook" },
    { label: "Triggers", value: "Intent keyword" },
    { label: "Transparency", value: "CoT timeline" },
  ],
};

const KEY_ARCH: Record<FeatureDetailKey, { title: string; body: string }[]> = {
  sessionRouting: [
    { title: "Proxy pool", body: "Residential / mobile / datacenter endpoints with health tracking." },
    { title: "Session vault", body: "AES-256-GCM encrypted session blobs with fingerprint and user-agent." },
    { title: "Health guardian", body: "Probe loop + latency signal + auto-degrade on failure." },
  ],
  commentEngine: [
    { title: "Listener discovery", body: "Poll keyword or competitor queries → target posts via connector." },
    { title: "AI draft", body: "Hybrid gateway (9Router) + knowledge + skill context → comment draft." },
    { title: "Approval → Send", body: "Human gate, bulk actions, delayed queue, connector delivery." },
  ],
  agentIntelligence: [
    { title: "Persona & guardrails", body: "Tone, language, system prompt, max sentences, no-spam rules." },
    { title: "Knowledge ingest", body: "Chunk text → token rank → contextual injection into draft prompt." },
    { title: "Memory ledger", body: "Long-term facts keyed by entity type, recalled in playground." },
  ],
  skillExecution: [
    { title: "Skill registry", body: "Slug, triggers, executor, high-risk flag per workspace." },
    { title: "Intent trigger", body: "Substring match on target post → auto run first matching skill." },
    { title: "CoT + Delivery", body: "Steps timeline persisted, output merged into comment context." },
  ],
};

const KEY_FEATURES: Record<FeatureDetailKey, { icon: typeof ShieldIcon; title: string; body: string }[]> = {
  sessionRouting: [
    { icon: ShieldIcon, title: "Encrypted vault", body: "Session blobs AES-256-GCM, key versioned." },
    { icon: LanguageIcon, title: "Multi-proxy grid", body: "Assign residential/mobile/datacenter per account." },
    { icon: ScheduleIcon, title: "IP rotation", body: "Sticky, per-action, or timed rotation with reason log." },
    { icon: BoltIcon, title: "Health scoring", body: "Score 10-100, auto degrade/ban detection with notifications." },
  ],
  commentEngine: [
    { icon: AccountTreeIcon, title: "Approval-first", body: "Editable drafts, bulk approve/reject, audit trail." },
    { icon: ScheduleIcon, title: "Human-like pacing", body: "Platform-aware random delay (IG ≥3m, Threads ≥4m, TikTok ≥5m) configurable per campaign." },
    { icon: ShieldIcon, title: "Rate limits", body: "Per-platform safe caps (IG 50/day, Threads 40/day, TikTok 30/day) + hourly pace + monthly workspace caps." },
    { icon: AutoAwesomeIcon, title: "AI powered", body: "Gateway routed, fallback local, risk-scanner guarded." },
  ],
  agentIntelligence: [
    { icon: SmartToyIcon, title: "Persona", body: "Name, tone, language, system prompt — per agent." },
    { icon: DescriptionIcon, title: "Knowledge RAG", body: "Text upload → chunk 500 chars → token overlap ranking." },
    { icon: LayersIcon, title: "Memory", body: "Fact ledger per entity, confidence scoring." },
    { icon: BoltIcon, title: "Playground", body: "Test draft instantly with knowledge + skill context." },
  ],
  skillExecution: [
    { icon: LayersIcon, title: "Registry", body: "Slug-unique per workspace, triggers keyword array." },
    { icon: CableIcon, title: "Webhook executor", body: "POST skill slug + text, Bearer token, parse text/message." },
    { icon: ShieldIcon, title: "High-risk guard", body: "Forces manual approval even in auto campaign mode." },
    { icon: AccountTreeIcon, title: "Run timeline", body: "Ordinal steps persisted, audited per execution." },
  ],
};

function FeatureMock({ detailKey }: { detailKey: FeatureDetailKey }) {
  if (detailKey === "sessionRouting") return <SessionRoutingMock />;
  if (detailKey === "commentEngine") return <CommentEngineMock />;
  if (detailKey === "agentIntelligence") return <AgentIntelligenceMock />;
  return <SkillExecutionMock />;
}

const RELATED_FEATURES: Record<
  FeatureDetailKey,
  Array<{ key: FeatureDetailKey; name: string; path: string; blurb: string }>
> = {
  sessionRouting: [
    { key: "commentEngine", name: "Comment Engine", path: "/features/comment-engine", blurb: "Send paced, approval-gated comments over healthy sessions." },
    { key: "agentIntelligence", name: "Agent Intelligence", path: "/features/agent-intelligence", blurb: "Draft contextual replies with guardrails." },
    { key: "skillExecution", name: "Skill Execution", path: "/features/skill-execution", blurb: "Trigger automations from comment intent." },
  ],
  commentEngine: [
    { key: "sessionRouting", name: "Session Routing", path: "/features/session-routing", blurb: "Keep accounts healthy behind proxy pools." },
    { key: "agentIntelligence", name: "Agent Intelligence", path: "/features/agent-intelligence", blurb: "Generate drafts with knowledge + memory." },
    { key: "skillExecution", name: "Skill Execution", path: "/features/skill-execution", blurb: "Run skills before a draft is sent." },
  ],
  agentIntelligence: [
    { key: "commentEngine", name: "Comment Engine", path: "/features/comment-engine", blurb: "Deliver AI drafts with pacing + approval." },
    { key: "skillExecution", name: "Skill Execution", path: "/features/skill-execution", blurb: "Enrich drafts with skill output." },
    { key: "sessionRouting", name: "Session Routing", path: "/features/session-routing", blurb: "Operate every account safely at scale." },
  ],
  skillExecution: [
    { key: "agentIntelligence", name: "Agent Intelligence", path: "/features/agent-intelligence", blurb: "Merge skill output into AI drafts." },
    { key: "commentEngine", name: "Comment Engine", path: "/features/comment-engine", blurb: "Gate skill-triggered sends with approval." },
    { key: "sessionRouting", name: "Session Routing", path: "/features/session-routing", blurb: "Run skills over healthy sessions." },
  ],
};

export function FeatureDetailPage({ detailKey }: { detailKey: FeatureDetailKey }) {
  const { t } = useLocale();
  const copy = t.featureDetails[detailKey];
  const Icon = KEY_ICONS[detailKey];
  const stats = KEY_STATS[detailKey];
  const arch = KEY_ARCH[detailKey];
  const features = KEY_FEATURES[detailKey];
  const related = RELATED_FEATURES[detailKey];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 md:px-8">
      {/* Breadcrumb (visible): Home › Features › this feature */}
      <nav aria-label="Breadcrumb" className="pt-8 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <LocaleLink href="/" className="hover:text-foreground hover:underline">
              Home
            </LocaleLink>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            <LocaleLink href="/features" className="hover:text-foreground hover:underline">
              Features
            </LocaleLink>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="text-foreground">
            {copy.title}
          </li>
        </ol>
      </nav>
      {/* Hero */}
      <div className="grid gap-8 py-12 md:grid-cols-5 md:py-20">
        <div className="md:col-span-3">
          <div className="mb-4 flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {copy.title}
            </Badge>
            <span className="text-xs text-muted-foreground">Enterprise control plane</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-5xl md:leading-[1.05]">
            {copy.title} for scale, with governance.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {copy.subtitle} Built for operators who need throughput without losing approval control.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" variant="electric" render={<LocaleLink href="/signup" />} nativeButton={false}>
              {copy.cta}
            </Button>
            <Button size="lg" variant="glass" render={<LocaleLink href="/contact" />} nativeButton={false}>
              Talk to sales
            </Button>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
            {stats.map((s) => (
              <Card key={s.label} className="py-0 shadow-none">
                <CardContent className="p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
                  <div className="mt-1 text-sm font-semibold leading-tight">{s.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <FeatureMock detailKey={detailKey} />
          <Card className="mt-4 border-dashed bg-muted/30 py-0 shadow-none"><CardContent className="px-4 py-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Live preview mock.</span> Data shown is synthetic and not from real accounts.
          </CardContent></Card>
        </div>
      </div>

      {/* Feature grid */}
      <div id="features-detail" className="scroll-mt-28 border-t py-12">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Capabilities</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Everything you need to operate {copy.title.toLowerCase()} at production scale.
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Card key={f.title} className="rounded-2xl">
              <CardHeader className="p-5 pb-2">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg border bg-muted/50">
                  <f.icon className="h-4 w-4" />
                </div>
                <CardTitle className="text-sm">{f.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 text-xs leading-relaxed text-muted-foreground">{f.body}</CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Architecture */}
      <div className="border-t py-12">
        <h2 className="text-2xl font-semibold tracking-tight">Architecture</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">How {copy.title} flows from trigger to result.</p>
        <div className="mt-6 flex flex-col items-stretch gap-2 md:flex-row md:items-center">
          {arch.map((step, i) => (
            <div key={step.title} className="flex flex-1 items-stretch gap-2">
              {i > 0 ? (
                <div className="hidden items-center md:flex">
                  <div className="h-px w-6 bg-border" />
                  <span className="text-muted-foreground">›</span>
                  <div className="h-px w-6 bg-border" />
                </div>
              ) : null}
              <Card className="flex-1 py-0 shadow-none">
                <CardContent className="p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
                      {i + 1}
                    </span>
                    <span className="text-xs font-semibold">{step.title}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* Points */}
      <div className="border-t py-12">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">Why it matters</h3>
            <p className="mt-2 text-sm text-muted-foreground">{copy.subtitle}</p>
            <ul className="mt-6 space-y-3">
              {copy.points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <Card className="bg-muted/30 py-0 shadow-none"><CardContent className="p-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Security & control</div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <ShieldIcon className="h-4 w-4 text-muted-foreground" />
                <span>Encrypted secrets + least-privilege workspace isolation</span>
              </div>
              <div className="flex items-center gap-2">
                <BoltIcon className="h-4 w-4 text-muted-foreground" />
                <span>Rate limits and human-like pacing enforced</span>
              </div>
              <div className="flex items-center gap-2">
                <DescriptionIcon className="h-4 w-4 text-muted-foreground" />
                <span>Audit logs for every config, approval, and publish action</span>
              </div>
            </div>
          </CardContent></Card>
        </div>
      </div>

      {/* Related features: cross-link the /features/* cluster */}
      <div className="border-t py-12">
        <h2 className="text-2xl font-semibold tracking-tight">Related features</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Combine {copy.title} with the rest of the control plane.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {related.map((item) => (
            <LocaleLink
              key={item.path}
              href={item.path}
              className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors group-hover:border-foreground/20 group-hover:bg-muted/30">
                <CardHeader className="p-5 pb-2">
                  <CardTitle className="text-sm group-hover:underline group-hover:underline-offset-4">
                    {item.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0 text-xs leading-relaxed text-muted-foreground">
                  {item.blurb}
                </CardContent>
              </Card>
            </LocaleLink>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div className="glass-blue mt-2 rounded-[2rem] px-6 py-10 text-white md:px-10 md:py-12">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Ready to run {copy.title}?</h2>
            <p className="mt-2 max-w-xl text-sm text-neutral-300">
              Create a workspace, connect accounts, and launch your first campaign with approval-first safety.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              variant="electric"
              render={<LocaleLink href="/signup" />}
              nativeButton={false}
            >
              {copy.cta}
            </Button>
            <Button
              size="lg"
              variant="glass"
              render={<LocaleLink href="/docs" />}
              nativeButton={false}
            >
              Read docs
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
