import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";

export default function BillingSettingsPage() {
  return (
    <div>
      <PageHeader title="Billing" description="Plan and usage placeholders for foundation." />
      <div className="max-w-xl rounded-2xl border border bg-background p-6">
        <div className="text-sm text-muted-foreground">Current plan</div>
        <div className="mt-1 text-2xl font-semibold">Growth (placeholder)</div>
        <p className="mt-3 text-sm text-muted-foreground">
          Stripe billing and usage enforcement ship after the foundation slice.
        </p>
        <Link
          href="/enterprise"
          className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white"
        >
          Talk to enterprise
        </Link>
      </div>
    </div>
  );
}
