import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth, signIn } from "@/lib/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/app");

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Log in to Aether</CardTitle>
          <CardDescription>Use your Google workspace account to continue.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/onboarding" });
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              Continue with Google
            </Button>
          </form>
          <Button asChild variant="ghost">
            <Link href="/">Back to site</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
