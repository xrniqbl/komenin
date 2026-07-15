import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/page-header";
import { createProxy } from "@/server/proxies";
import type { ProxyProtocol, ProxyType, RotationMode } from "@prisma/client";

export default function NewProxyPage() {
  async function submit(formData: FormData) {
    "use server";
    const proxy = await createProxy({
      label: String(formData.get("label") || ""),
      protocol: String(formData.get("protocol") || "http") as ProxyProtocol,
      host: String(formData.get("host") || ""),
      port: Number(formData.get("port") || 0),
      username: String(formData.get("username") || "") || undefined,
      password: String(formData.get("password") || "") || undefined,
      provider: String(formData.get("provider") || "") || undefined,
      type: String(formData.get("type") || "residential") as ProxyType,
      country: String(formData.get("country") || "") || undefined,
      rotationMode: String(formData.get("rotationMode") || "sticky") as RotationMode,
      rotateEveryMin: formData.get("rotateEveryMin")
        ? Number(formData.get("rotateEveryMin"))
        : undefined,
    });
    redirect(`/app/proxies/${proxy.id}`);
  }

  return (
    <div>
      <PageHeader
        title="Add proxy"
        description="Register an HTTP/SOCKS5 endpoint for tunnel assignment."
        action={
          <Button variant="link" render={<Link href="/app/proxies" />} nativeButton={false}>
            Back to proxies
          </Button>
        }
      />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <form action={submit} className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="label">Label</Label>
                <Input id="label" name="label" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="provider">Provider</Label>
                <Input id="provider" name="provider" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="protocol">Protocol</Label>
                <select id="protocol" name="protocol" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" defaultValue="http">
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                  <option value="socks5">SOCKS5</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="host">Host</Label>
                <Input id="host" name="host" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="port">Port</Label>
                <Input id="port" name="port" type="number" required />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" name="username" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="type">Type</Label>
                <select id="type" name="type" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" defaultValue="residential">
                  <option value="residential">Residential</option>
                  <option value="mobile">Mobile</option>
                  <option value="datacenter">Datacenter</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rotationMode">Rotation mode</Label>
                <select id="rotationMode" name="rotationMode" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" defaultValue="sticky">
                  <option value="sticky">Sticky</option>
                  <option value="per_action">Per action</option>
                  <option value="timed">Timed</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rotateEveryMin">Rotate every (min)</Label>
                <Input id="rotateEveryMin" name="rotateEveryMin" type="number" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" placeholder="ID" />
            </div>
            <Button type="submit" size="lg">
              Save proxy
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
