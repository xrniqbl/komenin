import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const pillars = [
  {
    title: "Session Routing",
    body: "Proxy pools, anti-detect sessions, and a high-performance multi-tunnel account grid.",
  },
  {
    title: "Comment Engine",
    body: "Keyword listeners, contextual drafts, human-like pacing, and approval queues.",
  },
  {
    title: "Agent Intelligence",
    body: "Persona, guardrails, RAG knowledge, and long-term memory for accurate replies.",
  },
  {
    title: "Skill Execution",
    body: "Function calling with intent triggers and transparent chain-of-thought logs.",
  },
];

export function PillarsSection() {
  return (
    <section className="bg-muted/30 py-16 md:py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 md:px-6">
        <div className="flex max-w-2xl flex-col gap-4">
          <Badge variant="secondary" className="w-fit">
            Product pillars
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Four control pillars</h2>
          <p className="text-lg text-muted-foreground">
            Built for operators who need scale without losing governance.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {pillars.map((pillar) => (
            <Card key={pillar.title}>
              <CardHeader>
                <CardTitle>{pillar.title}</CardTitle>
                <CardDescription>{pillar.body}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
