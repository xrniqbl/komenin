"use client";

import Link from "next/link";
import {
  BookOpen,
  Boxes,
  Bot,
  Cable,
  Rocket,
  Shield,
  Webhook,
  Workflow,
} from "lucide-react";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const iconByHref: Record<string, typeof Rocket> = {
  "/docs/tutorial/introduction": Rocket,
  "/docs/tutorial/connectors": Cable,
  "/docs/tutorial/campaigns": Workflow,
  "/docs/tutorial/agents": Bot,
  "/docs/api": Boxes,
  "/docs/tutorial/security": Shield,
  "/docs/tutorial/golden-path": BookOpen,
  "/docs/tutorial/command-center": Workflow,
  "/docs/tutorial/troubleshooting": Shield,
  "/docs/tutorial/faq": BookOpen,
};

export function DocsHome() {
  const { t } = useLocale();
  const ui = t.docsUi;

  return (
    <div className="min-w-0 flex-1 px-4 py-10 md:px-8 md:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{ui.homeTitle}</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">{ui.homeSubtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" render={<Link href="/docs/tutorial/introduction" />} nativeButton={false}>
              {ui.getStarted}
            </Button>
            <Button size="lg" variant="outline" render={<Link href="/docs/api" />} nativeButton={false}>
              {ui.apiReference}
            </Button>
            <Button
              size="lg"
              variant="outline"
              render={<Link href="/docs/tutorial/quick-start" />}
              nativeButton={false}
            >
              {ui.quickStart}
            </Button>
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ui.cards.map((card) => {
            const Icon = iconByHref[card.href] || BookOpen;
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
              <CardTitle className="text-lg">{ui.tutorialPath}</CardTitle>
              <CardDescription>{ui.tutorialPathBody}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button render={<Link href="/docs/tutorial/introduction" />} nativeButton={false}>
                {ui.openTutorial}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="mb-2 inline-flex size-10 items-center justify-center rounded-xl bg-muted">
                <Webhook className="size-5" />
              </div>
              <CardTitle className="text-lg">{ui.integrationPath}</CardTitle>
              <CardDescription>{ui.integrationPathBody}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" render={<Link href="/docs/api/worker" />} nativeButton={false}>
                {ui.openWorkerApi}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
