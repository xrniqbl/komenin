import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CtaBand() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="gap-3">
            <CardTitle className="text-3xl md:text-4xl">
              Ready to run controlled engagement ops?
            </CardTitle>
            <CardDescription className="max-w-2xl text-base text-primary-foreground/80">
              Create a workspace, invite your team, and launch with approval-first automation.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link href="/signup">Start free</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/20 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link href="/contact">Talk to sales</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
