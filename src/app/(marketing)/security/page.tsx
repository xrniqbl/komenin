"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SecurityPage() {
  const { t } = useLocale();
  const copy = t.securityPage;

  return (
    <div className="bg-transparent">
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:px-8 md:py-20">
      <div className="mb-8">
        <Button variant="glass" size="sm" render={<Link href="/" />} nativeButton={false}>
          {copy.backHome}
        </Button>
      </div>

      <p className="text-sm font-medium tracking-wide text-electric-400 uppercase">
        {copy.badge}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
        {copy.title}
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-neutral-400">{copy.subtitle}</p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {copy.sections.map((section) => (
          <Card key={section.title} className="glass border-white/10 bg-white/5 shadow-none backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg text-white">{section.title}</CardTitle>
              <CardDescription className="text-neutral-400">{section.body}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {section.bullets.map((bullet) => (
                <div key={bullet} className="flex items-start gap-2 text-sm text-neutral-400">
                  <span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-electric-500" />
                  <span>{bullet}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" variant="electric" render={<Link href="/signup" />} nativeButton={false} className="rounded-full">
          {copy.cta}
        </Button>
        <Button size="lg" variant="glass" render={<Link href="/" />} nativeButton={false} className="rounded-full">
          {copy.backHome}
        </Button>
      </div>
    </div>
    </div>
  );
}
