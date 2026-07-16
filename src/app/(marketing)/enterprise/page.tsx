"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function EnterprisePage() {
  const { t } = useLocale();
  const copy = t.enterprisePage;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
      <div className="mb-8">
        <Button variant="outline" size="sm" render={<Link href="/" />} nativeButton={false}>
          {copy.backHome}
        </Button>
      </div>

      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          {copy.badge}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{copy.subtitle}</p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {copy.sections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="text-lg">{section.title}</CardTitle>
              <CardDescription>{section.body}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {section.bullets.map((bullet) => (
                <div key={bullet} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-neutral-900" />
                  <span>{bullet}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mx-auto mt-8 max-w-3xl">
        <CardHeader>
          <CardTitle className="text-xl">{copy.fitTitle}</CardTitle>
          <CardDescription>{copy.fitBody}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" render={<Link href="/contact" />} nativeButton={false}>
            {copy.cta}
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/" />} nativeButton={false}>
            {copy.backHome}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
