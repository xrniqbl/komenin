"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";

export default function AboutPage() {
  const { t } = useLocale();
  const copy = t.aboutPage;

  return (
    <div className="bg-transparent">
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:px-8 md:py-20">
      <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
        {copy.title}
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-neutral-400">{copy.subtitle}</p>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-neutral-400">
        {copy.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <div className="mt-8">
        <Button size="lg" variant="electric" render={<Link href="/signup" />} nativeButton={false} className="rounded-full">
          {copy.cta}
        </Button>
      </div>
    </div>
    </div>
  );
}
