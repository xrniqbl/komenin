"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SectionKey = "agencies" | "instagram" | "tiktok" | "threads" | "integrations";

export function PlatformDetailPage({ sectionKey }: { sectionKey: SectionKey }) {
  const { t } = useLocale();
  const copy = t.platformPage;
  const section = copy[sectionKey];

  return (
    <div style={{ backgroundColor: "#0A0F1E" }}>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:px-8 md:py-20">
        <div className="mb-8">
          <Button
            variant="glass"
            size="sm"
            render={<Link href="/" />}
            nativeButton={false}
            className="text-sm"
          >
            {copy.backHome}
          </Button>
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-electric-400">
            {copy.badge}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {section.title}
          </h1>
          <p className="mt-4 text-lg text-neutral-400">{section.subtitle}</p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {section.sections.map((block) => (
            <Card
              key={block.title}
              className="glass border-white/10 bg-white/5 backdrop-blur-xl"
            >
              <CardHeader>
                <CardTitle className="text-lg text-white">{block.title}</CardTitle>
                <CardDescription className="text-neutral-400">{block.body}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {block.bullets.map((bullet) => (
                  <div key={bullet} className="flex items-start gap-2 text-sm text-neutral-400">
                    <span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-electric-400" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mx-auto mt-8 max-w-3xl glass border-white/10 bg-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-xl text-white">{section.title}</CardTitle>
            <CardDescription className="text-neutral-400">{section.subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" variant="electric" render={<Link href="/signup" />} nativeButton={false} className="rounded-full">
              {copy.cta}
            </Button>
            <Button
              size="lg"
              variant="glass"
              render={<Link href="/contact" />}
              nativeButton={false}
              className="rounded-full"
            >
              {copy.talkSales}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
