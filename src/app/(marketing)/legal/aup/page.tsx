import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 md:px-8">
      <h1 className="text-3xl font-semibold text-foreground md:text-4xl">Acceptable Use Policy</h1>
      <p className="mt-4 text-lg text-muted-foreground">Automation must respect platform rules, consent, and rate limits.</p>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>No spam campaigns</li>
            <li>Approval and quota controls expected</li>
            <li>Abuse may result in suspension</li>
      </ul>
      <div className="mt-8"><Button variant="default" size="lg" render={<Link href="/contact" />} nativeButton={false}>Contact</Button></div>
    </div>
  );
}
