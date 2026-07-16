"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SecuritySection() {
  const { t } = useLocale();
  const copy = t.securitySection;

  return (
    <section className="bg-muted/30 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Card>
          <CardHeader className="gap-4">
            <Badge variant="secondary" className="w-fit">
              {copy.badge}
            </Badge>
            <CardTitle className="text-3xl md:text-4xl">{copy.title}</CardTitle>
            <CardDescription className="max-w-2xl text-base">{copy.body}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {copy.chips.map((item) => (
              <Badge key={item} variant="outline">
                {item}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
