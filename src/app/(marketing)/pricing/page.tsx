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
import { AI_PLANS } from "@/lib/billing/catalog";
import { cn } from "@/lib/utils";

export default function PricingPage() {
  const { t } = useLocale();
  const copy = t.pricingPage;

  return (
    <div className="relative overflow-hidden bg-transparent">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,rgba(46,124,246,0.12),transparent_55%)]" />
        <div className="absolute top-1/3 -left-20 h-96 w-96 rounded-full bg-electric-500/8 blur-[120px]" />
        <div className="absolute top-2/3 -right-20 h-96 w-96 rounded-full bg-purple-500/8 blur-[120px]" />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-14 sm:px-6 md:gap-12 md:py-20">
        <div className="flex justify-start">
          <Button variant="glass" size="sm" render={<Link href="/" />} nativeButton={false}>
            {copy.backHome}
          </Button>
        </div>

        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
          <Badge className="w-fit border-white/10 bg-white/5 text-neutral-300">
            {copy.badge}
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            {copy.compareTitle}
          </h1>
          <p className="max-w-2xl text-base text-neutral-400 sm:text-lg">
            {copy.compareSubtitle}
          </p>
          <p className="max-w-2xl text-sm text-neutral-400 sm:text-base">
            {copy.subtitle}
          </p>
          <p className="text-xs text-neutral-500">{copy.currencyNote}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
          {billingPlans.map((plan) => {
            const planCopy = copy.plans[plan.id];
            return (
              <Card
                key={plan.id}
                className={cn(
                  "glass relative flex h-full flex-col rounded-2xl",
                  plan.featured &&
                    "border-electric-500/40 shadow-[0_0_40px_rgba(46,124,246,0.15)] md:-translate-y-1 md:scale-[1.02]",
                )}
              >
                {planCopy.badge ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="border-0 bg-electric-500 text-white">
                      {planCopy.badge}
                    </Badge>
                  </div>
                ) : null}

                <CardHeader className="gap-3 pt-8">
                  <CardDescription className="text-sm font-medium text-white">
                    {planCopy.name}
                  </CardDescription>
                  <div className="flex flex-wrap items-end gap-2">
                    <CardTitle className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                      {formatPrice(plan.priceMonthly)}
                    </CardTitle>
                    <span className="pb-1 text-sm text-neutral-400">
                      {copy.perMonth}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-400">
                    {copy.billedEvery} {formatPrice(plan.priceTotal)} {copy.every}{" "}
                    {plan.months} {plan.months === 1 ? copy.month : copy.months}
                  </p>
                  <p className="text-sm text-neutral-400">{planCopy.description}</p>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-3">
                  {planCopy.features.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-start gap-2 text-sm text-neutral-400"
                    >
                      <span className="mt-1 inline-block size-1.5 shrink-0 rounded-full bg-electric-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </CardContent>

                <CardFooter className="pt-2">
                  <Button
                    className="w-full"
                    variant={plan.featured ? "electric" : "glass"}
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

        <Card className="glass rounded-2xl p-5 sm:p-6">
          <div className="mb-5 max-w-3xl">
            <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {copy.comparisonHeading}
            </h2>
            <p className="mt-2 text-sm text-neutral-400 sm:text-base">
              {copy.savingsNote}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm [&_tr]:border-white/10">
              <thead>
                <tr className="border-white/10">
                  <th className="py-3 pr-4 font-medium text-neutral-400"> </th>
                  {billingPlans.map((plan) => (
                    <th key={plan.id} className="px-3 py-3 font-semibold text-white">
                      {copy.plans[plan.id].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {copy.comparisonRows.map((row) => (
                  <tr key={row.label} className="border-b last:border-b-0">
                    <th className="py-3 pr-4 align-top font-medium text-white">
                      {row.label}
                    </th>
                    {billingPlans.map((plan) => (
                      <td
                        key={`${row.label}-${plan.id}`}
                        className="px-3 py-3 align-top text-neutral-400"
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

        {/* Komenin AI add-on */}
        <section className="flex flex-col gap-6">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
            <Badge className="w-fit border-white/10 bg-white/5 text-neutral-300">
              {copy.ai.badge}
            </Badge>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {copy.ai.title}
            </h2>
            <p className="max-w-2xl text-sm text-neutral-400 sm:text-base">
              {copy.ai.subtitle}
            </p>
            <p className="text-xs text-neutral-500">{copy.ai.byokNote}</p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-white">{copy.ai.tiersHeading}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {AI_PLANS.filter((p) => p.kind === "ai_subscription" && p.durationMonths === 1).map(
                (plan) => (
                  <Card key={plan.code} className="glass flex h-full flex-col rounded-2xl">
                    <CardHeader className="gap-2">
                      <CardDescription className="text-sm font-medium text-white">
                        {plan.name}
                      </CardDescription>
                      <div className="flex items-end gap-2">
                        <CardTitle className="text-2xl font-semibold text-white">
                          {formatPrice(plan.priceMonthlyIdr)}
                        </CardTitle>
                        <span className="pb-0.5 text-xs text-neutral-400">
                          {copy.ai.perMonth}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400">
                        {new Intl.NumberFormat("id-ID").format(Number(plan.aiCredits ?? 0n))}{" "}
                        {copy.ai.creditsPerMonth}
                      </p>
                    </CardHeader>
                    <CardFooter className="mt-auto pt-2">
                      <Button
                        className="w-full"
                        variant="electric"
                        render={<Link href={`/app/checkout?plan=${plan.code}`} />}
                        nativeButton={false}
                      >
                        {copy.ai.buyCta}
                      </Button>
                    </CardFooter>
                  </Card>
                ),
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-white">{copy.ai.paygHeading}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {AI_PLANS.filter((p) => p.kind === "ai_credits").map((plan) => (
                <Card key={plan.code} className="glass flex h-full flex-col rounded-2xl">
                  <CardHeader className="gap-2">
                    <CardDescription className="text-sm font-medium text-white">
                      {plan.name}
                    </CardDescription>
                    <div className="flex items-end gap-2">
                      <CardTitle className="text-2xl font-semibold text-white">
                        {formatPrice(plan.priceIdr)}
                      </CardTitle>
                    </div>
                    <p className="text-xs text-neutral-400">
                      {new Intl.NumberFormat("id-ID").format(Number(plan.aiCredits ?? 0n))}{" "}
                      {copy.ai.credits}
                    </p>
                  </CardHeader>
                    <CardFooter className="mt-auto pt-2">
                      <Button
                        className="w-full"
                        variant="glass"
                        render={<Link href={`/app/checkout?plan=${plan.code}`} />}
                        nativeButton={false}
                      >
                        {copy.ai.buyPackCta}
                      </Button>
                    </CardFooter>
                </Card>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <section aria-labelledby="ai-faq-heading">
            <h2 id="ai-faq-heading" className="mb-3 text-base font-semibold text-white">
              {copy.ai.faqHeading}
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {copy.ai.faq.map((item) => (
                <Card key={item.q} className="glass rounded-2xl">
                  <CardHeader className="gap-1 p-4">
                    <CardTitle className="text-sm text-white">{item.q}</CardTitle>
                    <CardDescription className="text-sm text-neutral-400">{item.a}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </section>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card className="glass rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg text-white">{copy.whyTitle}</CardTitle>
              <CardDescription>{copy.whyBody}</CardDescription>
            </CardHeader>
          </Card>
          <Card className="glass rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg text-white">{copy.footerTitle}</CardTitle>
              <CardDescription>{copy.footerNote}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row">
              <Button variant="electric" render={<Link href="/contact" />} nativeButton={false} className="rounded-full">
                {copy.talkSales}
              </Button>
              <Button variant="glass" render={<Link href="/" />} nativeButton={false} className="rounded-full">
                {copy.backHome}
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
