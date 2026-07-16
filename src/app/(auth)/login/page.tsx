import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { signInWithGoogle } from "@/server/auth-actions";

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
          <form action={signInWithGoogle.bind(null, "/onboarding")}>
            <Button
              type="submit"
              className="w-full bg-neutral-900 text-white hover:bg-neutral-800"
              size="lg"
            >
              Continue with Google
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            If the button fails after a hot reload, use{" "}
            <Link
              href="/api/auth/signin/google?callbackUrl=%2Fonboarding"
              className="font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-700"
            >
              this direct Google sign-in link
            </Link>
            .
          </p>
          <Button
            variant="outline"
            className="w-full"
            render={<Link href="/" />}
            nativeButton={false}
          >
            Back to site
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}