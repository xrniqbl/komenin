"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ChangelogPage() {
  const { t } = useLocale();
  const copy = t.platformPage;
  const log = copy.changelog;

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
            {log.title}
          </h1>
          <p className="mt-4 text-lg text-neutral-400">{log.subtitle}</p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl space-y-4">
          {log.entries.map((entry) => (
            <Card
              key={`${entry.date}-${entry.title}`}
              className="glass border-white/10 bg-white/5 backdrop-blur-xl"
            >
              <CardHeader>
                <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  {entry.date}
                </div>
                <CardTitle className="text-lg text-white">{entry.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-neutral-400">
                {entry.body}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" variant="electric" render={<Link href="/signup" />} nativeButton={false} className="rounded-full">
            {copy.cta}
          </Button>
          <Button
            size="lg"
            variant="glass"
            render={<Link href="/pricing" />}
            nativeButton={false}
            className="rounded-full"
          >
            Pricing
          </Button>
        </div>
      </div>
    </div>
  );
}
