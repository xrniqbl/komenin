import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { ConnectAccountForm } from "@/components/accounts/connect-account-form";
import { createAccount } from "@/server/accounts";
import { listProxies } from "@/server/proxies";
import type { Platform } from "@prisma/client";

export default async function NewAccountPage() {
  const proxies = await listProxies();

  async function submit(formData: FormData) {
    "use server";
    const account = await createAccount({
      platform: String(formData.get("platform") || "instagram") as Platform,
      username: String(formData.get("username") || ""),
      displayName: String(formData.get("displayName") || "") || undefined,
      proxyEndpointId: String(formData.get("proxyId") || "") || undefined,
      sessionPayload: String(formData.get("sessionPayload") || ""),
      userAgent: String(formData.get("userAgent") || "") || undefined,
    });
    redirect(`/app/accounts/${account.id}`);
  }

  return (
    <div>
      <PageHeader
        title="Connect account"
        description="Import production session cookies for Instagram, Threads, or TikTok and bind an optional proxy tunnel."
        action={
          <Button variant="link" render={<Link href="/app/accounts" />} nativeButton={false}>
            Back to accounts
          </Button>
        }
      />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <ConnectAccountForm
            action={submit}
            proxies={proxies.map((proxy) => ({
              id: proxy.id,
              label: `${proxy.label} (${proxy.host}:${proxy.port})`,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
