import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  "Connect social accounts with proxy-backed sessions",
  "Launch campaigns with approval-first controls",
  "Ground agents in your knowledge and personas",
  "Trigger skills and review chain-of-thought logs",
];

export function HowItWorksSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 md:px-6">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">How it works</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {steps.map((step, index) => (
            <Card key={step}>
              <CardHeader>
                <CardTitle className="text-base">Step {index + 1}</CardTitle>
                <CardDescription>{step}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
