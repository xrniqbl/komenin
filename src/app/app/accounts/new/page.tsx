import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/page-header";
import { ConnectAccountForm } from "@/components/accounts/connect-account-form";
import { ConnectWizard } from "@/components/accounts/connect-wizard";
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
  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto") || "http";
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "localhost:3000";
  const appOrigin = process.env.APP_URL?.trim() || `${proto}://${host}`;

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
      <Tabs defaultValue="cookie" className="max-w-2xl">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="cookie">Sesi (mudah)</TabsTrigger>
          <TabsTrigger value="oauth">OAuth resmi</TabsTrigger>
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
              <CardTitle className="text-base">Sambungkan dalam 3 langkah</CardTitle>
              <CardDescription>
                Tanpa persetujuan Meta. Pilih platform → ambil akses lewat ekstensi atau tempel
                manual → simpan. Sesi disimpan terenkripsi.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectWizard
                proxies={proxies.map((p) => ({
                  id: p.id,
                  label: `${p.label} (${p.host}:${p.port})`,
                }))}
                action={submit}
                appOrigin={appOrigin}
              />
            </CardContent>
          </Card>

          <details className="mt-4 max-w-2xl rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
              Pengguna tingkat lanjut: form impor cookie mentah
            </summary>
            <div className="mt-4">
              <ConnectAccountForm
                action={submit}
                proxies={proxies.map((p) => ({
                  id: p.id,
                  label: `${p.label} (${p.host}:${p.port})`,
                }))}
              />
            </div>
          </details>
        </TabsContent>
      </Tabs>
    </div>
  );
}
