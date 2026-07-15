import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function HeroSection() {
  return (
    <section className="border-b">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center md:px-6 md:py-24">
        <div className="flex flex-col gap-6">
          <Badge variant="secondary" className="w-fit">
            Enterprise social operations
          </Badge>
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              Operate social engagement with enterprise control
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Route sessions, run contextual campaigns, ground agents in your knowledge, and execute skills with full auditability.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Start free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/contact">Book demo</Link>
            </Button>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Multi-tunnel grid</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {[
              { account: "@brand.ig", status: "healthy" },
              { account: "@growth.threads", status: "healthy" },
              { account: "@ops.tiktok", status: "healthy" },
            ].map((row) => (
              <div
                key={row.account}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <span className="text-sm font-medium">{row.account}</span>
                <Badge variant="secondary">{row.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
