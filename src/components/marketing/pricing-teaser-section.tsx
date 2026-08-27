"use client";

import Link from "next/link";
import { LocaleLink } from "@/components/i18n/locale-link";
import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { billingPlans, formatPrice } from "@/data/pricing";
import { cn } from "@/lib/utils";

export function PricingTeaserSection() {
  const { t } = useLocale();

  return (
    <section id="pricing" className="scroll-mt-28 border-y bg-muted/20 py-16 md:py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <Badge variant="secondary">{t.pricingTeaser.badge}</Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {t.pricingTeaser.title}
          </h2>
          <p className="text-base text-muted-foreground sm:text-lg">
            {t.pricingTeaser.subtitle}
          </p>
          <p className="text-xs text-muted-foreground">{t.pricingPage.currencyNote}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {billingPlans.map((plan) => {
            const planCopy = t.pricingPage.plans[plan.id];
            return (
              <Card
                key={plan.id}
                className={cn(
                  "flex h-full flex-col",
                  plan.featured && "border-neutral-900 shadow-md sm:col-span-2 lg:col-span-1",
                )}
              >
                <CardHeader className="gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardDescription className="text-foreground">
                      {planCopy.name}
                    </CardDescription>
                    {planCopy.badge ? (
                      <Badge variant="secondary">{planCopy.badge}</Badge>
                    ) : null}
                  </div>
                  <CardTitle className="text-2xl sm:text-3xl">
                    {formatPrice(plan.priceMonthly)}
                    <span className="text-sm font-normal text-muted-foreground">
                      {t.pricingTeaser.perMonth}
                    </span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {formatPrice(plan.priceTotal)} {t.pricingTeaser.billed} / {plan.months}{" "}
                    {plan.months === 1 ? t.pricingPage.month : t.pricingPage.months}
                  </p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-2 text-sm text-muted-foreground">
                  {planCopy.features.slice(0, 3).map((feature) => (
                    <div key={feature}>{feature}</div>
                  ))}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.featured ? "default" : "outline"}
                    render={<LocaleLink href="/pricing" />}
                    nativeButton={false}
                  >
                    {t.pricingTeaser.viewPlan}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-center">
          <Button size="lg" render={<LocaleLink href="/pricing" />} nativeButton={false}>
            {t.pricingTeaser.compare}
          </Button>
        </div>
      </div>
    </section>
  );
}