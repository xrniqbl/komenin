import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const plans = [
  {
    name: "Starter",
    price: "$99",
    features: ["5 social accounts", "Approval-required campaigns", "1 agent"],
    featured: false,
  },
  {
    name: "Growth",
    price: "$399",
    features: ["50 social accounts", "Proxy pools", "RAG knowledge base"],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    features: ["Custom limits", "Audit export", "SLA & onboarding"],
    featured: false,
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 md:px-6 md:py-24">
      <div className="flex max-w-2xl flex-col gap-4">
        <Badge variant="secondary" className="w-fit">
          Pricing
        </Badge>
        <h1 className="text-4xl font-semibold tracking-tight">Plans for every ops stage</h1>
        <p className="text-lg text-muted-foreground">
          Self-serve plans with an enterprise path when you need custom controls.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.name} className={plan.featured ? "border-primary shadow-md" : undefined}>
            <CardHeader>
              <CardDescription>{plan.name}</CardDescription>
              <CardTitle className="text-3xl">{plan.price}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
              {plan.features.map((feature) => (
                <div key={feature}>{feature}</div>
              ))}
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full" variant={plan.featured ? "default" : "outline"}>
                <Link href={plan.name === "Enterprise" ? "/contact" : "/signup"}>
                  {plan.name === "Enterprise" ? "Contact sales" : "Start free"}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
