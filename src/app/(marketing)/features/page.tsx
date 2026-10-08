"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURE_HREFS = [
  "/features/session-routing",
  "/features/comment-engine",
  "/docs/tutorial/content",
  "/features/agent-intelligence",
  "/docs/tutorial/approvals",
  "/docs/tutorial/connectors",
] as const;

export default function FeaturesPage() {
  const { t } = useLocale();
  const copy = t.featuresPage;

  return (
    <div style={{ backgroundColor: "#0A0F1E" }}>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-4 text-lg text-neutral-400">{copy.subtitle}</p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {copy.items.map((item, index) => {
            const href = FEATURE_HREFS[index] || "/features";
            const isPublic = href.startsWith("/features") || href.startsWith("/docs");
            return (
              <Link
                key={item.title}
                href={isPublic ? href : "/signup"}
                className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <Card className="h-full glass border-white/10 bg-white/5 backdrop-blur-xl transition-colors group-hover:border-white/25 group-hover:bg-white/10">
                  <CardHeader>
                    <CardTitle className="text-lg text-white group-hover:underline group-hover:underline-offset-4">
                      {item.title}
                    </CardTitle>
                    <CardDescription className="text-sm leading-6 text-neutral-400">
                      {item.body}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" variant="electric" render={<Link href="/signup" />} nativeButton={false} className="rounded-full">
            {copy.cta}
          </Button>
          <Button
            size="lg"
            variant="glass"
            render={<Link href="/pricing" />}
            nativeButton={false}
            className="rounded-full"
          >
            Pricing
          </Button>
          <Button
            size="lg"
            variant="ghost"
            render={<Link href="/docs" />}
            nativeButton={false}
            className="text-neutral-300 hover:bg-white/10 hover:text-white"
          >
            Docs
          </Button>
        </div>
      </div>
    </div>
  );
}
