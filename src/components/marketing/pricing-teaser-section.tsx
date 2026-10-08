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
import { Reveal } from "./reveal";

export function PricingTeaserSection() {
  const { t } = useLocale();

  return (
    <section id="pricing" className="scroll-mt-28 border-y border-white/10 py-16 md:py-24" style={{ backgroundColor: "#0A0F1E" }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 sm:px-6">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <Badge variant="outline" className="border-electric-500/30 bg-electric-500/10 text-electric-300">{t.pricingTeaser.badge}</Badge>
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {t.pricingTeaser.title}
          </h2>
          <p className="text-base text-neutral-400 sm:text-lg">
            {t.pricingTeaser.subtitle}
          </p>
          <p className="text-xs text-neutral-500">{t.pricingPage.currencyNote}</p>
        </Reveal>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {billingPlans.map((plan, index) => {
            const planCopy = t.pricingPage.plans[plan.id];
            return (
              <Reveal
                key={plan.id}
                delay={index * 0.1}
                className={cn("h-full", plan.featured && "sm:col-span-2 lg:col-span-1")}
              >
                <Card
                  className={cn(
                    "glass flex h-full flex-col rounded-2xl",
                    plan.featured && "border-electric-500/40 shadow-[0_0_40px_rgba(46,124,246,0.15)]",
                  )}
                >
                  <CardHeader className="gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardDescription className="text-neutral-300">
                        {planCopy.name}
                      </CardDescription>
                      {planCopy.badge ? (
                        <Badge variant="outline" className="border-electric-500/30 bg-electric-500/10 text-electric-300">{planCopy.badge}</Badge>
                      ) : null}
                    </div>
                    <CardTitle className="text-2xl text-white sm:text-3xl">
                      {formatPrice(plan.priceMonthly)}
                      <span className="text-sm font-normal text-neutral-500">
                        {t.pricingTeaser.perMonth}
                      </span>
                    </CardTitle>
                    <p className="text-sm text-neutral-500">
                      {formatPrice(plan.priceTotal)} {t.pricingTeaser.billed} / {plan.months}{" "}
                      {plan.months === 1 ? t.pricingPage.month : t.pricingPage.months}
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-2 text-sm text-neutral-400">
                    {planCopy.features.slice(0, 3).map((feature) => (
                      <div key={feature}>{feature}</div>
                    ))}
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={plan.featured ? "electric" : "glass"}
                      render={<LocaleLink href="/pricing" />}
                      nativeButton={false}
                    >
                      {t.pricingTeaser.viewPlan}
                    </Button>
                  </CardFooter>
                </Card>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="flex justify-center">
          <Button
            size="lg"
            variant="electric"
            render={<LocaleLink href="/pricing" />}
            nativeButton={false}
            className="rounded-full"
          >
            {t.pricingTeaser.compare}
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
