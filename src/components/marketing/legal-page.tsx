"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";

type LegalKey = "privacy" | "terms" | "aup";

export function LegalPage({ legalKey }: { legalKey: LegalKey }) {
  const { t } = useLocale();
  const copy = t.legalPages[legalKey];

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:px-8 md:py-20">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {copy.title}
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-muted-foreground">{copy.subtitle}</p>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-muted-foreground">
        {copy.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <div className="mt-8">
        <Button size="lg" render={<Link href={copy.href} />} nativeButton={false}>
          {copy.cta}
        </Button>
      </div>
    </div>
  );
}
