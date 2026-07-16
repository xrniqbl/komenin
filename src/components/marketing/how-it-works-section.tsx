"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function HowItWorksSection() {
  const { t } = useLocale();
  const copy = t.howItWorks;

  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 md:px-6">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{copy.title}</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {copy.steps.map((step, index) => (
            <Card key={step}>
              <CardHeader>
                <CardTitle className="text-base">
                  {copy.step} {index + 1}
                </CardTitle>
                <CardDescription>{step}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
