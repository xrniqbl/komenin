import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/page-header";
import { ConnectAccountForm } from "@/components/accounts/connect-account-form";
import { createAccount } from "@/server/accounts";
import { listProxies } from "@/server/proxies";
import { getPublisherStatus } from "@/server/publisher-settings";
import type { Platform } from "@prisma/client";

const OAUTH_PLATFORMS = [
  {
    id: "tiktok",
    label: "TikTok",
    description: "Login dengan akun TikTok lalu klik Authorize.",
    href: "/api/connectors/tiktok/authorize",
    readyKey: "tiktokOAuthConfigured" as const,
  },
  {
    id: "threads",
    label: "Threads",
    description: "Login dengan akun Threads lalu klik Authorize.",
    href: "/api/connectors/threads/authorize",
    readyKey: "threadsOAuthConfigured" as const,
  },
  {
    id: "instagram",
    label: "Instagram",
    description: "Login dengan akun Instagram lalu klik Authorize.",
    href: "/api/connectors/instagram/authorize",
    readyKey: "instagramOAuthConfigured" as const,
  },
];

export default async function NewAccountPage() {
  const proxies = await listProxies();
  const status = await getPublisherStatus();

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
        description="Pilih cara menyambungkan akun sosial media."
        action={
          <Button variant="link" render={<Link href="/app/accounts" />} nativeButton={false}>
            Back to accounts
          </Button>
        }
      />
      <Tabs defaultValue="oauth" className="max-w-2xl">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="oauth">Sekali klik (OAuth)</TabsTrigger>
          <TabsTrigger value="cookie">Session cookie</TabsTrigger>
        </TabsList>
        <TabsContent value="oauth">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connect sekali klik</CardTitle>
              <CardDescription>
                Klik tombol platform, login di situs resminya, klik Authorize — akun otomatis tersambung.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {OAUTH_PLATFORMS.map((platform) => {
                const ready = status[platform.readyKey];
                return (
                  <div
                    key={platform.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{platform.label}</p>
                      <p className="text-xs text-neutral-400">{platform.description}</p>
                    </div>
                    <Button
                      variant="electric"
                      size="sm"
                      disabled={!ready}
                      render={<Link href={platform.href} />}
                      nativeButton={false}
                    >
                      {ready ? `Connect ${platform.label}` : "Belum dikonfigurasi"}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="cookie">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import session cookie</CardTitle>
              <CardDescription>
                Untuk pengguna advanced: import session cookies production untuk Instagram, Threads, atau TikTok dan bind proxy tunnel opsional.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectAccountForm
                action={submit}
                proxies={proxies.map((proxy) => ({
                  id: proxy.id,
                  label: `${proxy.label} (${proxy.host}:${proxy.port})`,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
