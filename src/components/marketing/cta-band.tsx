"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import ArrowForwardIcon from '@mui/icons-material/ArrowForwardRounded';
import { LocaleLink } from "@/components/i18n/locale-link";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { gsap, prefersReducedMotion } from "./gsap-setup";
import { Reveal } from "./reveal";

export function CtaBand() {
  const { t } = useLocale();
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.to(".cta-wave", {
        x: -120,
        duration: 14,
        ease: "none",
        repeat: -1,
      });
    },
    { scope },
  );

  return (
    <section ref={scope} className="bg-ink-950 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-electric-600 via-electric-500 to-electric-700 shadow-[0_0_80px_rgba(46,124,246,0.35)]">
            {/* Animated wave lines */}
            <svg
              aria-hidden="true"
              className="cta-wave pointer-events-none absolute inset-y-0 left-0 h-full w-[200%] opacity-20"
              preserveAspectRatio="none"
              viewBox="0 0 2400 400"
            >
              {[0, 1, 2, 3].map((row) => (
                <path
                  key={row}
                  d={`M -100 ${80 + row * 80} Q 200 ${40 + row * 80}, 500 ${80 + row * 80} T 1100 ${80 + row * 80} T 1700 ${80 + row * 80} T 2300 ${80 + row * 80} T 2900 ${80 + row * 80}`}
                  fill="none"
                  stroke="white"
                  strokeWidth="1.5"
                />
              ))}
            </svg>
            {/* Glow orbs */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/20 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-electric-900/40 blur-3xl"
            />

            <div className="relative px-6 py-14 sm:px-10 sm:py-16">
              <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
                <h2 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
                  {t.cta.title}
                </h2>
                <p className="max-w-2xl text-base text-electric-100 md:text-lg">
                  {t.cta.subtitle}
                </p>
                <div className="mt-3 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
                  <Button
                    size="lg"
                    variant="electric"
                    className="w-full rounded-full sm:w-auto"
                    render={<LocaleLink href="/signup" />}
                    nativeButton={false}
                  >
                    {t.cta.startFree}
                    <ArrowForwardIcon className="ml-1 h-4 w-4" />
                  </Button>
                  <Button
                    size="lg"
                    variant="glass"
                    className="w-full rounded-full text-white sm:w-auto"
                    render={<LocaleLink href="/contact" />}
                    nativeButton={false}
                  >
                    {t.cta.talkSales}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
