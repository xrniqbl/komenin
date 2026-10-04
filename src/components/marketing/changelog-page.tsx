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
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:px-8 md:py-20">
      <div className="mb-8">
        <Button variant="outline" size="sm" render={<Link href="/" />} nativeButton={false}>
          {copy.backHome}
        </Button>
      </div>

      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {copy.badge}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {log.title}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{log.subtitle}</p>
      </div>

      <div className="mx-auto mt-10 max-w-3xl space-y-4">
        {log.entries.map((entry) => (
          <Card key={`${entry.date}-${entry.title}`}>
            <CardHeader>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {entry.date}
              </div>
              <CardTitle className="text-lg">{entry.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              {entry.body}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" render={<Link href="/signup" />} nativeButton={false}>
          {copy.cta}
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/pricing" />} nativeButton={false}>
          Pricing
        </Button>
      </div>
    </div>
  );
}
