"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function FeaturesPage() {
  const { t } = useLocale();
  const copy = t.featuresPage;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{copy.subtitle}</p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {copy.items.map((item) => (
          <Card key={item.title} className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">{item.title}</CardTitle>
              <CardDescription className="text-sm leading-6">{item.body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <Button size="lg" render={<Link href="/signup" />} nativeButton={false}>
          {copy.cta}
        </Button>
      </div>
    </div>
  );
}