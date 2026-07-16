"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";

export function CtaBand() {
  const { t } = useLocale();

  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-900 px-6 py-10 text-white shadow-sm sm:px-10 sm:py-12">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              {t.cta.title}
            </h2>
            <p className="max-w-2xl text-base text-neutral-300">{t.cta.subtitle}</p>
            <div className="mt-2 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
              <Button
                size="lg"
                className="w-full bg-white text-neutral-900 hover:bg-neutral-100 sm:w-auto"
                render={<Link href="/signup" />}
                nativeButton={false}
              >
                {t.cta.startFree}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full border-neutral-600 bg-transparent text-white hover:bg-white/10 sm:w-auto"
                render={<Link href="/contact" />}
                nativeButton={false}
              >
                {t.cta.talkSales}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}