"use client";

import PsychologyIcon from '@mui/icons-material/PsychologyRounded';
import ForumIcon from '@mui/icons-material/ForumRounded';
import RouteIcon from '@mui/icons-material/RouteRounded';
import BoltIcon from '@mui/icons-material/BoltRounded';
import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "./reveal";

const ICONS = [RouteIcon, ForumIcon, PsychologyIcon, BoltIcon];

export function PillarsSection() {
  const { t } = useLocale();
  const copy = t.pillars;

  return (
    <section id="features" className="scroll-mt-28 bg-ink-950 py-16 md:py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 md:px-6">
        <Reveal className="flex max-w-2xl flex-col items-start gap-4">
          <Badge
            variant="outline"
            className="w-fit border-electric-500/30 bg-electric-500/10 text-electric-300"
          >
            {copy.badge}
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {copy.title}
          </h2>
          <p className="text-lg text-neutral-400">{copy.subtitle}</p>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2">
          {copy.items.map((pillar, index) => {
            const Icon = ICONS[index % ICONS.length] ?? RouteIcon;
            return (
              <Reveal key={pillar.title} delay={index * 0.08} className="h-full">
                <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-ink-900 p-6 transition-colors hover:border-electric-500/30 md:p-8">
                  {/* Hover glow */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-electric-600/0 blur-3xl transition-all duration-500 group-hover:bg-electric-600/15"
                  />
                  <div className="relative flex flex-col gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-electric-500/20 bg-electric-500/10">
                      <Icon className="h-5 w-5 text-electric-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{pillar.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                        {pillar.body}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
