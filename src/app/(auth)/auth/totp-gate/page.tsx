import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TotpGateForm } from "@/components/auth/totp-gate-form";

export const metadata = { title: "Verifikasi dua langkah" };

export default async function TotpGatePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  // Already verified (or 2FA disabled) — continue into the app.
  if (!session.user.totpGate) redirect("/app");

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <TotpGateForm />
      </div>
    </div>
  );
}
