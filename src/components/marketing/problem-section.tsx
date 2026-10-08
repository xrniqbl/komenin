"use client";

import AccessTimeIcon from '@mui/icons-material/AccessTimeRounded';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOffRounded';
import WarningIcon from '@mui/icons-material/WarningRounded';
import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "./reveal";

const ICONS = [VisibilityOffIcon, AccessTimeIcon, WarningIcon];

export function ProblemSection() {
  const { t } = useLocale();
  const copy = t.problem;

  return (
    <section className="py-16 md:py-24" style={{ backgroundColor: "#0A0F1E" }}>
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

        <div className="grid gap-4 md:grid-cols-3">
          {copy.items.map((item, index) => {
            const Icon = ICONS[index % ICONS.length] ?? VisibilityOffIcon;
            return (
              <Reveal key={item.title} delay={index * 0.08} className="h-full">
                <div className="glass h-full rounded-2xl p-6 transition-colors hover:border-electric-500/30 md:p-8">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-500/10">
                    <Icon className="h-5 w-5 text-electric-400" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-400">{item.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
