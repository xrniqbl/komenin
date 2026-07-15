import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 md:px-8">
      <h1 className="text-3xl font-semibold text-foreground md:text-4xl">Agent Intelligence</h1>
      <p className="mt-4 text-lg text-muted-foreground">Train agents with persona, guardrails, knowledge, and memory.</p>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>Persona configuration</li>
            <li>RAG document ingestion</li>
            <li>Long-term memory ledger</li>
            <li>Playground testing</li>
      </ul>
      <div className="mt-8"><Button variant="default" size="lg" render={<Link href="/signup" />} nativeButton={false}>Start free</Button></div>
    </div>
  );
}
