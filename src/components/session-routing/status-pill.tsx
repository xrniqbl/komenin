import { Badge } from "@/components/ui/badge";

export function StatusPill({
  label,
}: {
  label: string;
  color?: string;
}) {
  const variant =
    ["healthy", "active", "sent", "ok"].some((v) => label.includes(v))
      ? "secondary"
      : ["banned", "failed", "down", "rejected"].some((v) => label.includes(v))
        ? "destructive"
        : "outline";

  return <Badge variant={variant as "secondary" | "destructive" | "outline"}>{label}</Badge>;
}
