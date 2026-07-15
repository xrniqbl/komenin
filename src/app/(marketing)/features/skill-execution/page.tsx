import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 md:px-8">
      <h1 className="text-3xl font-semibold text-foreground md:text-4xl">Skill Execution</h1>
      <p className="mt-4 text-lg text-muted-foreground">Let agents call approved skills with transparent chain-of-thought logs.</p>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>Skill registry</li>
            <li>Intent auto-triggers</li>
            <li>Builtin and webhook skills</li>
            <li>CoT run timeline</li>
      </ul>
      <div className="mt-8"><Button variant="default" size="lg" asChild><Link href="/signup">Start free
      </Link></Button></div>
    </div>
  );
}
