"use client";

import LinkIcon from '@mui/icons-material/LinkRounded';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHighRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded';
import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocaleLink } from "@/components/i18n/locale-link";
import { Reveal } from "./reveal";
import {
  ApprovalQueueCard,
  CampaignCard,
  AnalyticsCard,
  CampaignInputBar,
} from "./showcase-mocks";

const STEP_ICONS = [LinkIcon, AutoFixHighIcon, CheckCircleIcon];

export function ProductShowcaseSection() {
  const { t } = useLocale();
  const copy = t.productShowcase;

  return (
    <section className="py-16 md:py-24" style={{ backgroundColor: "#0A0F1E" }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 md:px-6">
        {/* Header */}
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <Badge
            variant="outline"
            className="w-fit border-electric-500/30 bg-electric-500/10 text-electric-300"
          >
            {copy.badge}
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {copy.title}
          </h2>
          <p className="text-base text-neutral-400 sm:text-lg">{copy.subtitle}</p>
        </Reveal>

        {/* Steps */}
        <div className="grid gap-3 md:grid-cols-3">
          {copy.steps.map((step, index) => {
            const Icon = STEP_ICONS[index % STEP_ICONS.length] ?? LinkIcon;
            return (
              <Reveal key={step.title} delay={index * 0.08}>
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-electric-600">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      <span className="mr-1.5 text-electric-400">{index + 1}.</span>
                      {step.title}
                    </div>
                    <div className="mt-1 text-xs leading-relaxed text-neutral-400">
                      {step.body}
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Device mockup */}
        <Reveal delay={0.15}>
          <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl glass rounded-2xl border-white/10 shadow-[0_0_80px_rgba(46,124,246,0.08)]">
            {/* Browser top bar */}
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
              </div>
              <div className="mx-auto rounded-md bg-white/5 px-4 py-1 text-[11px] text-neutral-500">
                app.komenin.id
              </div>
              <div className="w-12" />
            </div>

            {/* Mockup content */}
            <div className="space-y-4 p-4 md:p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <ApprovalQueueCard
                  title={copy.cards[0]?.title ?? ""}
                  subtitle={copy.cards[0]?.subtitle ?? ""}
                />
                <CampaignCard
                  title={copy.cards[1]?.title ?? ""}
                  subtitle={copy.cards[1]?.subtitle ?? ""}
                />
                <AnalyticsCard
                  title={copy.cards[2]?.title ?? ""}
                  subtitle={copy.cards[2]?.subtitle ?? ""}
                />
              </div>
              <CampaignInputBar placeholder={copy.inputPlaceholder} />
            </div>
          </div>
        </Reveal>

        {/* CTA */}
        <Reveal className="flex justify-center">
          <Button
            size="lg"
            variant="electric"
            render={<LocaleLink href="/signup" />}
            nativeButton={false}
            className="rounded-full"
          >
            {copy.cta}
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
