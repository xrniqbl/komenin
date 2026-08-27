import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { isSsoLoginEnforced } from "@/lib/sso-policy";
import { signInWithGoogle } from "@/server/auth-actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sso?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/app");
  const params = await searchParams;
  const ssoEnforcedFlag = isSsoLoginEnforced();

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Log in to Komenin</CardTitle>
          <CardDescription>Use your Google workspace account to continue.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {params.sso === "1" || params.sso === "invalid" ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
              {params.sso === "invalid"
                ? "SSO ticket was missing or expired. Continue with Google, or retry SSO from your IdP."
                : "SSO ACS completed a dev ticket handoff. If you were not signed in automatically, continue with Google."}
            </p>
          ) : null}
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
            Enterprise SAML SSO is stored as workspace config only
            {ssoEnforcedFlag ? " (SSO_ENFORCE_LOGIN is set, but ACS session bridge is not shipped)" : ""}
            . Full SSO login ships after signed ACS + Auth.js session integration.
          </p>
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