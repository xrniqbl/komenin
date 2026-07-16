"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  const { t } = useLocale();

  return (
    <section className="relative overflow-hidden border-b">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_top,rgba(23,23,23,0.06),transparent_60%)]" />
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-16 text-center sm:px-6 md:py-24">
        <Badge variant="secondary" className="mb-6">
          {t.hero.badge}
        </Badge>

        <h1 className="text-balance text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl md:text-6xl">
          {t.hero.title}
        </h1>

        <p className="mt-5 max-w-2xl text-base text-neutral-600 sm:text-lg">
          {t.hero.subtitle}
        </p>

        <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <Button
            size="lg"
            className="w-full bg-neutral-900 text-white hover:bg-neutral-800 sm:w-auto"
            render={<Link href="/signup" />}
            nativeButton={false}
          >
            {t.hero.startFree}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 sm:w-auto"
            render={<Link href="/features" />}
            nativeButton={false}
          >
            {t.hero.watchVideo}
          </Button>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-neutral-500 sm:text-sm">
          <span>{t.hero.point1}</span>
          <span>{t.hero.point2}</span>
          <span>{t.hero.point3}</span>
        </div>
      </div>
    </section>
  );
}