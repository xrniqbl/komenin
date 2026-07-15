import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 md:px-8">
      <h1 className="text-3xl font-semibold text-foreground md:text-4xl">Session Routing</h1>
      <p className="mt-4 text-lg text-muted-foreground">Manage proxies, anti-detect sessions, and multi-tunnel account health.</p>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>HTTP/SOCKS5 proxy pools</li>
            <li>Encrypted session vault</li>
            <li>IP rotation logs</li>
            <li>Account health grid</li>
      </ul>
      <div className="mt-8"><Button variant="default" size="lg" render={<Link href="/signup" />} nativeButton={false}>Start free</Button></div>
    </div>
  );
}
