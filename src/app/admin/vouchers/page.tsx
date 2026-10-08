import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPageWindow, ListPagination } from "@/components/app/list-pagination";
import { AdminListFilters } from "@/components/admin/admin-list-filters";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adminCreateVoucher,
  adminToggleVoucher,
  adminUpdateVoucher,
  listAdminVouchers,
} from "@/server/admin";

function formatDateInput(value: Date | null | undefined) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export default async function AdminVouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const result = await listAdminVouchers({ q: params.q, page: Number(params.page) || 1 });
  const window = getPageWindow(result.total, result.page, result.perPage);
  const vouchers = result.rows;

  async function createAction(formData: FormData) {
    "use server";
    await adminCreateVoucher({
      code: String(formData.get("code") || ""),
      type: String(formData.get("type") || "percent") as "percent" | "fixed",
      value: Number(formData.get("value") || 0),
      maxRedemptions: Number(formData.get("maxRedemptions") || 0) || undefined,
      perWorkspaceLimit: Number(formData.get("perWorkspaceLimit") || 1) || 1,
      minSubtotalIdr: Number(formData.get("minSubtotalIdr") || 0) || undefined,
      allowedPlanCodes: String(formData.get("allowedPlanCodes") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      expiresAt: String(formData.get("expiresAt") || "") || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vouchers</h1>
        <p className="text-sm text-muted-foreground">
          Create discount codes for checkout. Codes are uppercased and audited.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create voucher</CardTitle>
          <CardDescription>
            Percent values are 1–100. Fixed values are IDR. Leave max redemptions empty for unlimited.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createAction} className="grid gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">Code</Label>
              <Input id="code" name="code" placeholder="LAUNCH50" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="type">Type</Label>
              <FormSelect
                id="type"
                name="type"
                defaultValue="percent"
                options={[
                  { value: "percent", label: "percent" },
                  { value: "fixed", label: "fixed (IDR)" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="value">Value</Label>
              <Input id="value" name="value" type="number" min={1} placeholder="e.g. 20" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="maxRedemptions">Max redemptions</Label>
              <Input
                id="maxRedemptions"
                name="maxRedemptions"
                type="number"
                min={1}
                placeholder="unlimited"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="perWorkspaceLimit">Per workspace limit</Label>
              <Input id="perWorkspaceLimit" name="perWorkspaceLimit" type="number" min={1} defaultValue={1} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="minSubtotalIdr">Min subtotal (IDR)</Label>
              <Input id="minSubtotalIdr" name="minSubtotalIdr" type="number" min={0} placeholder="optional" />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="allowedPlanCodes">Allowed plan codes</Label>
              <Input
                id="allowedPlanCodes"
                name="allowedPlanCodes"
                placeholder="starter_1m,growth_6m (empty = all plans)"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="expiresAt">Expires at</Label>
              <Input id="expiresAt" name="expiresAt" type="date" />
            </div>
            <div className="md:col-span-3">
              <Button variant="electric" type="submit">Create voucher</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <AdminListFilters q={params.q} placeholder="Cari kode voucher…" />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Existing vouchers ({result.total})
          </h2>
        </div>

        {vouchers.length === 0 ? (
          <Card className="gap-0 overflow-hidden py-0">
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyTitle>No vouchers yet</EmptyTitle>
                <EmptyDescription>
                  Create a code above. Validated vouchers appear at checkout and can fully discount an order.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </Card>
        ) : (
          vouchers.map((voucher) => (
            <Card key={voucher.id}>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold tracking-wide">{voucher.code}</span>
                      <Badge variant={voucher.isActive ? "secondary" : "outline"}>
                        {voucher.isActive ? "active" : "disabled"}
                      </Badge>
                      <Badge variant="outline">
                        {voucher.type} {voucher.value}
                        {voucher.type === "percent" ? "%" : " IDR"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      redeemed {voucher.redeemedCount}
                      {voucher.maxRedemptions != null ? ` / ${voucher.maxRedemptions}` : " · unlimited"}
                      {" · "}
                      per workspace {voucher.perWorkspaceLimit}
                      {voucher.minSubtotalIdr != null ? ` · min ${voucher.minSubtotalIdr} IDR` : ""}
                      {voucher.expiresAt
                        ? ` · expires ${voucher.expiresAt.toISOString().slice(0, 10)}`
                        : " · no expiry"}
                      {voucher.allowedPlanCodes.length > 0
                        ? ` · plans ${voucher.allowedPlanCodes.join(", ")}`
                        : " · all plans"}
                    </div>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await adminToggleVoucher({
                        voucherId: voucher.id,
                        isActive: !voucher.isActive,
                      });
                    }}
                  >
                    <Button type="submit" variant="glass" size="sm">
                      {voucher.isActive ? "Disable" : "Enable"}
                    </Button>
                  </form>
                </div>

                <form
                  action={async (formData: FormData) => {
                    "use server";
                    const maxRaw = String(formData.get("maxRedemptions") || "").trim();
                    const minRaw = String(formData.get("minSubtotalIdr") || "").trim();
                    const expiresRaw = String(formData.get("expiresAt") || "").trim();
                    await adminUpdateVoucher({
                      voucherId: voucher.id,
                      value: Number(formData.get("value") || voucher.value),
                      maxRedemptions: maxRaw ? Number(maxRaw) : null,
                      perWorkspaceLimit: Number(formData.get("perWorkspaceLimit") || voucher.perWorkspaceLimit),
                      minSubtotalIdr: minRaw ? Number(minRaw) : null,
                      allowedPlanCodes: String(formData.get("allowedPlanCodes") || "")
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                      expiresAt: expiresRaw || null,
                    });
                  }}
                  className="grid gap-2 rounded-lg border bg-muted/20 p-3 md:grid-cols-3"
                >
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`value-${voucher.id}`} className="text-xs">
                      Value
                    </Label>
                    <Input
                      id={`value-${voucher.id}`}
                      name="value"
                      type="number"
                      min={1}
                      defaultValue={voucher.value}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`max-${voucher.id}`} className="text-xs">
                      Max redemptions
                    </Label>
                    <Input
                      id={`max-${voucher.id}`}
                      name="maxRedemptions"
                      type="number"
                      min={1}
                      defaultValue={voucher.maxRedemptions ?? ""}
                      placeholder="unlimited"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`per-${voucher.id}`} className="text-xs">
                      Per workspace
                    </Label>
                    <Input
                      id={`per-${voucher.id}`}
                      name="perWorkspaceLimit"
                      type="number"
                      min={1}
                      defaultValue={voucher.perWorkspaceLimit}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`min-${voucher.id}`} className="text-xs">
                      Min subtotal
                    </Label>
                    <Input
                      id={`min-${voucher.id}`}
                      name="minSubtotalIdr"
                      type="number"
                      min={0}
                      defaultValue={voucher.minSubtotalIdr ?? ""}
                      placeholder="none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`exp-${voucher.id}`} className="text-xs">
                      Expires
                    </Label>
                    <Input
                      id={`exp-${voucher.id}`}
                      name="expiresAt"
                      type="date"
                      defaultValue={formatDateInput(voucher.expiresAt)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 md:col-span-1">
                    <Label htmlFor={`plans-${voucher.id}`} className="text-xs">
                      Plan codes
                    </Label>
                    <Input
                      id={`plans-${voucher.id}`}
                      name="allowedPlanCodes"
                      defaultValue={voucher.allowedPlanCodes.join(",")}
                      placeholder="all plans"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Button type="submit" size="sm" variant="secondary">
                      Save changes
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ))
        )}
        <ListPagination
          pathname="/admin/vouchers"
          searchParams={{ q: params.q }}
          window={window}
        />
      </div>
    </div>
  );
}
