import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 md:px-8">
      <h1 className="text-3xl font-semibold text-foreground md:text-4xl">Features</h1>
      <p className="mt-4 text-lg text-muted-foreground">Four integrated pillars for enterprise social operations.</p>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>Session Routing</li>
            <li>Comment Engine</li>
            <li>Agent Intelligence</li>
            <li>Skill Execution</li>
      </ul>
      <div className="mt-8"><Button variant="default" size="lg" asChild><Link href="/signup">Start free
      </Link></Button></div>
    </div>
  );
}
