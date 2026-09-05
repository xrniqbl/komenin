"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";

type LegalKey = "privacy" | "terms" | "aup";

type LegalSection = {
  heading: string;
  paragraphs?: readonly string[];
  points?: readonly string[];
};

export function LegalPage({ legalKey }: { legalKey: LegalKey }) {
  const { t } = useLocale();
  const copy = t.legalPages[legalKey] as {
    title: string;
    subtitle: string;
    updated?: string;
    points?: readonly string[];
    sections?: readonly LegalSection[];
    cta: string;
    href: string;
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:px-8 md:py-20">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {copy.title}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">{copy.subtitle}</p>
      {copy.updated ? (
        <p className="mt-2 text-sm text-muted-foreground">{copy.updated}</p>
      ) : null}

      {copy.points && copy.points.length > 0 ? (
        <ul className="mt-6 list-disc space-y-2 pl-5 text-muted-foreground">
          {copy.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      ) : null}

      {copy.sections ? (
        <div className="mt-10 space-y-10">
          {copy.sections.map((section, i) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {i + 1}. {section.heading}
              </h2>
              {section.paragraphs?.map((p, j) => (
                <p key={j} className="mt-3 leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
              {section.points && section.points.length > 0 ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      ) : null}

      <div className="mt-12 border-t pt-8">
        <Button size="lg" render={<Link href={copy.href} />} nativeButton={false}>
          {copy.cta}
        </Button>
      </div>
    </div>
  );
}
