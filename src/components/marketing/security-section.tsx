import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SecuritySection() {
  return (
    <section className="bg-muted/30 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Card>
          <CardHeader className="gap-4">
            <Badge variant="secondary" className="w-fit">
              Security by default
            </Badge>
            <CardTitle className="text-3xl md:text-4xl">Security and control first</CardTitle>
            <CardDescription className="max-w-2xl text-base">
              Role-based access, encrypted session vaults, approval workflows, rate limits, and immutable audit logs keep enterprise operators in control.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {["RBAC", "Encrypted secrets", "Audit trail"].map((item) => (
              <Badge key={item} variant="outline">
                {item}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
