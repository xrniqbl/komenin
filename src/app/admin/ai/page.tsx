import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIdr } from "@/lib/billing/catalog";
import { getAdminAiMonetization } from "@/server/admin";

function fmtCredits(value: string): string {
  const n = Number(value);
  return new Intl.NumberFormat("id-ID").format(Number.isFinite(n) ? n : 0);
}

export default async function AdminAiMonetizationPage() {
  const data = await getAdminAiMonetization(30);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Komenin AI monetization</h1>
        <p className="text-sm text-muted-foreground">
          Pendapatan, pemakaian, dan margin AI · {data.rangeDays} hari terakhir
        </p>
      </div>

      {data.usage.marginAtRisk ? (
        <Alert variant="error">
          <AlertTitle>Margin berisiko</AlertTitle>
          <AlertDescription>
            Blended cost per credit ({formatIdr(data.usage.costPerCreditIdr)}) adalah{" "}
            {Math.round(data.usage.marginRatio * 100)}% dari blended price (
            {formatIdr(data.usage.revenuePerCreditIdr)}) — di atas ambang 60%. Tinjau harga
            jual atau biaya upstream per model.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription>Pendapatan AI</CardDescription>
            <CardTitle className="text-2xl">{formatIdr(data.revenue.totalIdr)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-4 pt-0 text-xs text-muted-foreground">
            <div>Langganan: {formatIdr(data.revenue.subscriptionIdr)}</div>
            <div>PAYG: {formatIdr(data.revenue.paygIdr)}</div>
            <div>
              {data.revenue.orderCount} order · {fmtCredits(data.revenue.creditsSold)} kredit terjual
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription>Pemakaian (Komenin-funded)</CardDescription>
            <CardTitle className="text-2xl">{fmtCredits(data.usage.creditsUsed)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-4 pt-0 text-xs text-muted-foreground">
            <div>Estimasi biaya upstream: {formatIdr(data.usage.costIdr)}</div>
            <div>Cost/credit: {formatIdr(data.usage.costPerCreditIdr)}</div>
            <div>Revenue/credit: {formatIdr(data.usage.revenuePerCreditIdr)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription>Subscription per tier</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 p-4 pt-0">
            {data.tiers.length === 0 ? (
              <div className="text-xs text-muted-foreground">Belum ada subscription AI.</div>
            ) : (
              data.tiers.map((t) => (
                <div key={`${t.tier}-${t.status}`} className="flex justify-between text-xs">
                  <span className="capitalize">{t.tier.replace("_", " ")}</span>
                  <span className="text-muted-foreground">
                    {t.count} · {t.status}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="text-sm">Margin per model (top 10 by cost)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.modelMargins.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Belum ada pemakaian Komenin-funded pada rentang ini.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Kredit terpakai</TableHead>
                  <TableHead className="text-right">Estimasi biaya</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.modelMargins.map((m) => (
                  <TableRow key={m.model}>
                    <TableCell className="font-mono text-xs">{m.model}</TableCell>
                    <TableCell className="text-right">{fmtCredits(m.credits)}</TableCell>
                    <TableCell className="text-right">{formatIdr(m.costIdr)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Biaya upstream dihitung dari tabel <code>AI_MODEL_COST_IDR</code> (IDR per kredit per
        model). Perbarui tabel itu dengan tarif 9Router aktual agar angka margin akurat.
      </p>
    </div>
  );
}
