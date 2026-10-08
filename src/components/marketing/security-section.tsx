"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "./reveal";

export function SecuritySection() {
  const { t } = useLocale();
  const copy = t.securitySection;

  return (
    <section className="py-16 md:py-24" style={{ backgroundColor: "#0A0F1E" }}>
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <Card className="glass rounded-2xl">
            <CardHeader className="gap-4">
              <Badge variant="outline" className="w-fit border-electric-500/30 bg-electric-500/10 text-electric-300">
                {copy.badge}
              </Badge>
              <CardTitle className="text-3xl text-white md:text-4xl">{copy.title}</CardTitle>
              <CardDescription className="max-w-2xl text-base text-neutral-400">{copy.body}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {copy.chips.map((item, index) => (
                <Reveal key={item} delay={index * 0.05} y={16}>
                  <Badge variant="outline" className="border-white/15 text-neutral-300">{item}</Badge>
                </Reveal>
              ))}
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </section>
  );
}
