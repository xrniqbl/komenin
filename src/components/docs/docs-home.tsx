"use client";

import Link from "next/link";
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import CableRoundedIcon from '@mui/icons-material/CableRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import WebhookRoundedIcon from '@mui/icons-material/WebhookRounded';

import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const iconByHref: Record<string, typeof RocketLaunchRoundedIcon> = {
  "/docs/tutorial/introduction": RocketLaunchRoundedIcon,
  "/docs/tutorial/connectors": CableRoundedIcon,
  "/docs/tutorial/campaigns": AccountTreeRoundedIcon,
  "/docs/tutorial/agents": SmartToyRoundedIcon,
  "/docs/api": Inventory2RoundedIcon,
  "/docs/tutorial/security": ShieldRoundedIcon,
  "/docs/tutorial/golden-path": MenuBookRoundedIcon,
  "/docs/tutorial/command-center": AccountTreeRoundedIcon,
  "/docs/tutorial/troubleshooting": ShieldRoundedIcon,
  "/docs/tutorial/faq": MenuBookRoundedIcon,
};

export function DocsHome() {
  const { t } = useLocale();
  const ui = t.docsUi;

  return (
    <div className="min-w-0 flex-1 px-4 py-10 md:px-8 md:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">{ui.homeTitle}</h1>
          <p className="mt-5 text-lg leading-8 text-neutral-400">{ui.homeSubtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="electric"
              size="lg"
              render={<Link href="/docs/tutorial/introduction" />}
              nativeButton={false}
              className="rounded-full bg-electric-600 text-white shadow-[0_0_32px_rgba(46,124,246,0.45)] hover:bg-electric-500"
            >
              {ui.getStarted}
            </Button>
            <Button
              size="lg"
              variant="glass"
              render={<Link href="/docs/api" />}
              nativeButton={false}
              className="rounded-full border-white/15 bg-white/5 text-white backdrop-blur-xl hover:border-white/30 hover:bg-white/10 hover:text-white"
            >
              {ui.apiReference}
            </Button>
            <Button
              size="lg"
              variant="glass"
              render={<Link href="/docs/tutorial/quick-start" />}
              nativeButton={false}
              className="rounded-full border-white/15 bg-white/5 text-white backdrop-blur-xl hover:border-white/30 hover:bg-white/10 hover:text-white"
            >
              {ui.quickStart}
            </Button>
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ui.cards.map((card) => {
            const Icon = iconByHref[card.href] || MenuBookRoundedIcon;
            return (
              <Link key={card.href} href={card.href} className="group">
                <Card className="h-full transition-colors group-hover:border-electric-500/30">
                  <CardHeader>
                    <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl border border-electric-500/20 bg-electric-500/10">
                      <Icon className="size-5 text-electric-400" />
                    </div>
                    <CardTitle className="text-lg text-white">{card.title}</CardTitle>
                    <CardDescription className="text-sm leading-6 text-neutral-400">{card.body}</CardDescription>
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
              <div className="mb-2 inline-flex size-10 items-center justify-center rounded-xl border border-electric-500/20 bg-electric-500/10">
                <MenuBookRoundedIcon className="size-5 text-electric-400" />
              </div>
              <CardTitle className="text-lg text-white">{ui.tutorialPath}</CardTitle>
              <CardDescription className="text-neutral-400">{ui.tutorialPathBody}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                render={<Link href="/docs/tutorial/introduction" />}
                nativeButton={false}
                className="rounded-full bg-electric-600 text-white shadow-[0_0_32px_rgba(46,124,246,0.45)] hover:bg-electric-500"
              >
                {ui.openTutorial}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="mb-2 inline-flex size-10 items-center justify-center rounded-xl border border-electric-500/20 bg-electric-500/10">
                <WebhookRoundedIcon className="size-5 text-electric-400" />
              </div>
              <CardTitle className="text-lg text-white">{ui.integrationPath}</CardTitle>
              <CardDescription className="text-neutral-400">{ui.integrationPathBody}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="glass"
                render={<Link href="/docs/api/worker" />}
                nativeButton={false}
                className="rounded-full border-white/15 bg-white/5 text-white backdrop-blur-xl hover:border-white/30 hover:bg-white/10 hover:text-white"
              >
                {ui.openWorkerApi}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
