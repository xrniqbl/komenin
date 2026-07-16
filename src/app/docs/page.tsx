import Link from "next/link";
import { BookOpen, Boxes, Bot, Cable, Rocket, Shield, Webhook, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const cards = [
  {
    href: "/docs/tutorial/introduction",
    title: "Getting Started",
    body: "New to Aether? Learn the core concepts and what you can manage from one workspace.",
    icon: Rocket,
  },
  {
    href: "/docs/tutorial/connectors",
    title: "Hybrid Connectors",
    body: "Use simulator for demos, webhook for live ops, and official adapters when credentials exist.",
    icon: Cable,
  },
  {
    href: "/docs/tutorial/campaigns",
    title: "Set Automation",
    body: "Run comment campaigns, approvals, paced sends, and auto-post schedules with guardrails.",
    icon: Workflow,
  },
  {
    href: "/docs/tutorial/agents",
    title: "Agent Intelligence",
    body: "Personas, knowledge retrieval, memory, and playground drafts before anything goes live.",
    icon: Bot,
  },
  {
    href: "/docs/api",
    title: "API Reference",
    body: "Trigger workers, receive publish webhooks, and handle Midtrans billing notifications.",
    icon: Boxes,
  },
  {
    href: "/docs/tutorial/security",
    title: "Security & Control",
    body: "Encrypted secrets, RBAC, approvals-by-default, usage limits, and audit export.",
    icon: Shield,
  },
  {
    href: "/docs/tutorial/golden-path",
    title: "Golden Path Demo",
    body: "Run the full simulator loop from signup to audited send/publish before going live.",
    icon: BookOpen,
  },
  {
    href: "/docs/tutorial/command-center",
    title: "Command Center",
    body: "Learn what to check daily in /app and where to click next when something degrades.",
    icon: Workflow,
  },
  {
    href: "/docs/tutorial/troubleshooting",
    title: "Troubleshooting",
    body: "Fix auth loops, empty inbox, worker 401s, live fail-closed errors, and billing pending states.",
    icon: Shield,
  },
  {
    href: "/docs/tutorial/faq",
    title: "FAQ",
    body: "Short answers about simulator vs live, approvals, Midtrans, workers, SSO, and admin access.",
    icon: BookOpen,
  },
];

export default function DocsHomePage() {
  return (
    <div className="min-w-0 flex-1 px-4 py-10 md:px-8 md:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Aether Documentation
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            Two ways to use Aether: follow the Tutorial to manage everything from the dashboard,
            or use the API Reference to build your own integration around workers, webhooks, and billing.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" render={<Link href="/docs/tutorial/introduction" />} nativeButton={false}>
              Get Started
            </Button>
            <Button size="lg" variant="outline" render={<Link href="/docs/api" />} nativeButton={false}>
              API Reference
            </Button>
            <Button size="lg" variant="outline" render={<Link href="/docs/tutorial/quick-start" />} nativeButton={false}>
              Quick Start
            </Button>
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.href} href={card.href} className="group">
                <Card className="h-full transition-colors group-hover:border-neutral-400">
                  <CardHeader>
                    <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-muted">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle className="text-lg">{card.title}</CardTitle>
                    <CardDescription className="text-sm leading-6">{card.body}</CardDescription>
                  </CardHeader>
                  <CardContent />
                </Card>
              </Link>
            );
          })}
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="mb-2 inline-flex size-10 items-center justify-center rounded-xl bg-muted">
                <BookOpen className="size-5" />
              </div>
              <CardTitle className="text-lg">Tutorial path</CardTitle>
              <CardDescription>
                Dashboard-first operators: accounts, campaigns, approvals, agents, billing, and admin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button render={<Link href="/docs/tutorial/introduction" />} nativeButton={false}>
                Open Tutorial
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="mb-2 inline-flex size-10 items-center justify-center rounded-xl bg-muted">
                <Webhook className="size-5" />
              </div>
              <CardTitle className="text-lg">Integration path</CardTitle>
              <CardDescription>
                Engineers: worker jobs, publish webhooks, Midtrans notifications, and SSO endpoints.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" render={<Link href="/docs/api/worker" />} nativeButton={false}>
                Open Worker API
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
