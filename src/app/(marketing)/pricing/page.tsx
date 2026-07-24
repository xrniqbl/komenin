"use client";

import Link from "next/link";
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
import { billingPlans, formatPrice, type BillingPlanId } from "@/data/pricing";
import { cn } from "@/lib/utils";

export default function PricingPage() {
  const { t } = useLocale();
  const copy = t.pricingPage;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top,rgba(23,23,23,0.08),transparent_55%)]" />

      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-14 sm:px-6 md:gap-12 md:py-20">
        <div className="flex justify-start">
          <Button variant="outline" size="sm" render={<Link href="/" />} nativeButton={false}>
            {copy.backHome}
          </Button>
        </div>

        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
          <Badge variant="secondary" className="w-fit">
            {copy.badge}
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            {copy.compareTitle}
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            {copy.compareSubtitle}
          </p>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            {copy.subtitle}
          </p>
          <p className="text-xs text-muted-foreground">{copy.currencyNote}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
          {billingPlans.map((plan) => {
            const planCopy = copy.plans[plan.id];
            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative flex h-full flex-col border bg-background/95 shadow-sm",
                  plan.featured &&
                    "border-neutral-900 shadow-lg md:-translate-y-1 md:scale-[1.02]",
                )}
              >
                {planCopy.badge ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-neutral-900 text-white hover:bg-neutral-900">
                      {planCopy.badge}
                    </Badge>
                  </div>
                ) : null}

                <CardHeader className="gap-3 pt-8">
                  <CardDescription className="text-sm font-medium text-foreground">
                    {planCopy.name}
                  </CardDescription>
                  <div className="flex flex-wrap items-end gap-2">
                    <CardTitle className="text-3xl font-semibold tracking-tight sm:text-4xl">
                      {formatPrice(plan.priceMonthly)}
                    </CardTitle>
                    <span className="pb-1 text-sm text-muted-foreground">
                      {copy.perMonth}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {copy.billedEvery} {formatPrice(plan.priceTotal)} {copy.every}{" "}
                    {plan.months} {plan.months === 1 ? copy.month : copy.months}
                  </p>
                  <p className="text-sm text-muted-foreground">{planCopy.description}</p>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-3">
                  {planCopy.features.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <span className="mt-1 inline-block size-1.5 shrink-0 rounded-full bg-neutral-900" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </CardContent>

                <CardFooter className="pt-2">
                  <Button
                    className="w-full"
                    variant={plan.featured ? "default" : "outline"}
                    size="lg"
                    render={<Link href={plan.href} />}
                    nativeButton={false}
                  >
                    {planCopy.cta}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <Card className="border bg-background/95 p-5 shadow-sm sm:p-6">
          <div className="mb-5 max-w-3xl">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {copy.comparisonHeading}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              {copy.savingsNote}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-3 pr-4 font-medium text-muted-foreground"> </th>
                  {billingPlans.map((plan) => (
                    <th key={plan.id} className="px-3 py-3 font-semibold text-foreground">
                      {copy.plans[plan.id].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {copy.comparisonRows.map((row) => (
                  <tr key={row.label} className="border-b last:border-b-0">
                    <th className="py-3 pr-4 align-top font-medium text-foreground">
                      {row.label}
                    </th>
                    {billingPlans.map((plan) => (
                      <td
                        key={`${row.label}-${plan.id}`}
                        className="px-3 py-3 align-top text-muted-foreground"
                      >
                        {row.values[plan.id as BillingPlanId]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{copy.whyTitle}</CardTitle>
              <CardDescription>{copy.whyBody}</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{copy.footerNote}</CardTitle>
              <CardDescription>{copy.footerNote}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row">
              <Button render={<Link href="/contact" />} nativeButton={false}>
                {copy.talkSales}
              </Button>
              <Button variant="outline" render={<Link href="/" />} nativeButton={false}>
                {copy.backHome}
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
