"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import ArrowForwardIcon from '@mui/icons-material/ArrowForwardRounded';
import PlayArrowIcon from '@mui/icons-material/PlayArrowRounded';
import { LocaleLink } from "@/components/i18n/locale-link";
import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { gsap, prefersReducedMotion, SplitText } from "./gsap-setup";
import { CommentEngineMock } from "./feature-demo-mocks";

export function HeroSection() {
  const { t, locale } = useLocale();
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      // Ambient blue glow — slow and subtle.
      gsap.to(".hero-blob", {
        y: 44,
        duration: 7,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        stagger: { each: 2.2, from: "random" },
      });

      // Entrance timeline: badge → headline (word by word) → subtitle → CTAs → mockup.
      const split = new SplitText(".hero-title", { type: "words" });
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".hero-badge", { y: 18, opacity: 0, duration: 0.5 })
        .from(split.words, { y: 44, opacity: 0, duration: 0.7, stagger: 0.06 }, "-=0.25")
        .from(".hero-subtitle", { y: 24, opacity: 0, duration: 0.6 }, "-=0.35")
        .from(".hero-cta", { y: 24, opacity: 0, duration: 0.5, stagger: 0.1 }, "-=0.35")
        .from(".hero-points", { y: 16, opacity: 0, duration: 0.5 }, "-=0.3")
        .from(".hero-mockup", { y: 60, opacity: 0, duration: 0.9 }, "-=0.3");

      return () => {
        split.revert();
      };
    },
    { scope },
  );

  return (
    <section ref={scope} className="relative overflow-hidden bg-ink-950">
      {/* Blue glow ambience */}
      <div
        aria-hidden="true"
        className="hero-blob pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-electric-600/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="hero-blob pointer-events-none absolute -left-40 top-64 -z-0 h-96 w-96 rounded-full bg-electric-500/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="hero-blob pointer-events-none absolute -right-40 top-96 h-96 w-96 rounded-full bg-electric-400/10 blur-3xl"
      />
      {/* Subtle grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
      />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 pt-16 pb-12 text-center sm:px-6 md:pt-24">
        <Badge
          variant="outline"
          className="hero-badge mb-6 border-electric-500/30 bg-electric-500/10 text-electric-300"
        >
          {t.hero.badge}
        </Badge>

        <h1 className="hero-title text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
          {t.hero.title}
        </h1>

        <p className="hero-subtitle mt-5 max-w-2xl text-base text-neutral-400 sm:text-lg">
          {t.hero.subtitle}
        </p>

        <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <Button
            size="lg"
            variant="electric"
            className="hero-cta w-full rounded-full sm:w-auto"
            render={<LocaleLink href="/signup" />}
            nativeButton={false}
          >
            {t.hero.startFree}
            <ArrowForwardIcon className="ml-1 h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="glass"
            className="hero-cta w-full rounded-full text-white sm:w-auto"
            render={<LocaleLink href="/features" />}
            nativeButton={false}
          >
            <PlayArrowIcon className="mr-1 h-4 w-4" />
            {locale === "id" ? "Jelajahi fitur" : "Explore features"}
          </Button>
        </div>

        <div className="hero-points mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-neutral-500 sm:text-sm">
          <span>{t.hero.point1}</span>
          <span className="text-neutral-700">·</span>
          <span>{t.hero.point2}</span>
          <span className="text-neutral-700">·</span>
          <span>{t.hero.point3}</span>
        </div>
      </div>

      {/* App mockup with blue glow */}
      <div className="hero-mockup relative mx-auto max-w-5xl px-4 pb-16 sm:px-6 md:pb-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 top-8 bottom-0 rounded-[2rem] bg-electric-600/25 blur-3xl"
        />
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-900/80 shadow-2xl backdrop-blur">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-white/10" />
            <span className="h-3 w-3 rounded-full bg-white/10" />
            <span className="h-3 w-3 rounded-full bg-white/10" />
            <span className="ml-3 rounded-md bg-white/5 px-3 py-1 text-xs text-neutral-500">
              komenin.id/app
            </span>
          </div>
          <div className="p-4 sm:p-6 [&_*]:!border-white/10">
            <CommentEngineMock />
          </div>
        </div>
      </div>
    </section>
  );
}
