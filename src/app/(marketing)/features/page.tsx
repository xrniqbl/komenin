"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURE_HREFS = [
  "/features/session-routing",
  "/features/comment-engine",
  "/features/agent-intelligence",
  "/features/skill-execution",
  "/app/approvals",
  "/docs/api",
] as const;

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
        {copy.items.map((item, index) => {
          const href = FEATURE_HREFS[index] || "/features";
          const isPublic = href.startsWith("/features") || href.startsWith("/docs");
          return (
            <Link
              key={item.title}
              href={isPublic ? href : "/signup"}
              className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors group-hover:border-foreground/20 group-hover:bg-muted/30">
                <CardHeader>
                  <CardTitle className="text-lg group-hover:underline group-hover:underline-offset-4">
                    {item.title}
                  </CardTitle>
                  <CardDescription className="text-sm leading-6">{item.body}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" render={<Link href="/signup" />} nativeButton={false}>
          {copy.cta}
        </Button>
        <Button
          size="lg"
          variant="outline"
          render={<Link href="/pricing" />}
          nativeButton={false}
        >
          Pricing
        </Button>
        <Button
          size="lg"
          variant="ghost"
          render={<Link href="/docs" />}
          nativeButton={false}
        >
          Docs
        </Button>
      </div>
    </div>
  );
}
