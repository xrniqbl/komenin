import { PageHeader } from "@/components/app/page-header";
import { CheckoutClient } from "@/components/billing/checkout-client";
import { listCheckoutPlans } from "@/server/billing";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const [plans, params] = await Promise.all([listCheckoutPlans(), searchParams]);
  return (
    <div>
      <PageHeader
        title="Checkout"
        description="Choose a plan, apply voucher, and pay securely with Midtrans Snap."
      />
      <CheckoutClient plans={plans} initialPlanCode={params.plan ?? null} />
    </div>
  );
}
