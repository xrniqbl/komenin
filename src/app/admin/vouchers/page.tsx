import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminCreateVoucher, adminToggleVoucher, listAdminVouchers } from "@/server/admin";

export default async function AdminVouchersPage() {
  const vouchers = await listAdminVouchers();

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
      <h1 className="text-2xl font-semibold">Vouchers</h1>
      <Card>
        <CardContent className="pt-6">
          <form action={createAction} className="grid gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">Code</Label>
              <Input id="code" name="code" placeholder="CODE" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="type">Type</Label>
              <FormSelect
                id="type"
                name="type"
                defaultValue="percent"
                options={[
                  { value: "percent", label: "percent" },
                  { value: "fixed", label: "fixed" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="value">Value</Label>
              <Input id="value" name="value" type="number" placeholder="value" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="maxRedemptions">Max redemptions</Label>
              <Input id="maxRedemptions" name="maxRedemptions" type="number" placeholder="max redemptions" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="perWorkspaceLimit">Per workspace limit</Label>
              <Input id="perWorkspaceLimit" name="perWorkspaceLimit" type="number" defaultValue={1} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="minSubtotalIdr">Min subtotal (IDR)</Label>
              <Input id="minSubtotalIdr" name="minSubtotalIdr" type="number" placeholder="min subtotal" />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="allowedPlanCodes">Allowed plan codes</Label>
              <Input id="allowedPlanCodes" name="allowedPlanCodes" placeholder="starter_1m,growth_6m" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="expiresAt">Expires at</Label>
              <Input id="expiresAt" name="expiresAt" type="date" />
            </div>
            <div className="md:col-span-3">
              <Button type="submit">Create voucher</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {vouchers.map((voucher) => (
          <form
            key={voucher.id}
            action={async () => {
              "use server";
              await adminToggleVoucher({ voucherId: voucher.id, isActive: !voucher.isActive });
            }}
            className="flex items-center justify-between rounded-2xl border bg-background p-4 text-sm"
          >
            <div>
              <div className="font-medium">
                {voucher.code} · {voucher.type} {voucher.value}
              </div>
              <div className="text-xs text-muted-foreground">
                redeemed {voucher.redeemedCount}
                {voucher.maxRedemptions != null ? ` / ${voucher.maxRedemptions}` : ""} ·{" "}
                {voucher.isActive ? "active" : "disabled"}
              </div>
            </div>
            <Button type="submit" variant="outline" size="sm">
              {voucher.isActive ? "Disable" : "Enable"}
            </Button>
          </form>
        ))}
      </div>
    </div>
  );
}
