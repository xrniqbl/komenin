import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PricingTeaserSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-8 px-4 md:flex-row md:items-end md:px-6">
        <div className="flex max-w-2xl flex-col gap-4">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Pricing that scales with ops
          </h2>
          <p className="text-lg text-muted-foreground">
            Start self-serve, then move into enterprise quotas, audit export, and guided onboarding.
          </p>
        </div>
        <Button size="lg" render={<Link href="/pricing" />} nativeButton={false}>
          View pricing
        </Button>
      </div>
    </section>
  );
}
