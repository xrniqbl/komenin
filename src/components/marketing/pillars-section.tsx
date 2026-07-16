"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PillarsSection() {
  const { t } = useLocale();
  const copy = t.pillars;

  return (
    <section id="features" className="scroll-mt-28 bg-muted/30 py-16 md:py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 md:px-6">
        <div className="flex max-w-2xl flex-col gap-4">
          <Badge variant="secondary" className="w-fit">
            {copy.badge}
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{copy.title}</h2>
          <p className="text-lg text-muted-foreground">{copy.subtitle}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {copy.items.map((pillar) => (
            <Card key={pillar.title}>
              <CardHeader>
                <CardTitle>{pillar.title}</CardTitle>
                <CardDescription>{pillar.body}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
