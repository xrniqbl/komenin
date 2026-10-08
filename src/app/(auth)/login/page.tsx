import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmailOtpForm } from "@/components/auth/email-otp-form";
import { auth } from "@/lib/auth";
import { signInWithGoogle } from "@/server/auth-actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sso?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = params.callbackUrl?.startsWith("/") && !params.callbackUrl.startsWith("//") && !params.callbackUrl.includes("\\")
    ? params.callbackUrl
    : "/onboarding";
  if (session?.user?.id) redirect(callbackUrl);

  return (
    <div className="bg-marketing relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* Ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-electric-500/12 blur-[120px]" />
        <div className="absolute right-1/4 bottom-1/4 h-72 w-72 rounded-full bg-purple-500/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/brand/komenin-robot-white.png"
              alt="Komenin"
              width={36}
              height={36}
              className="rounded-lg"
            />
            <span className="text-xl font-bold text-white">Komenin</span>
          </Link>
        </div>

        <Card className="glass-strong w-full rounded-3xl p-2">
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-2xl text-white">Welcome back</CardTitle>
            <CardDescription className="text-neutral-400">
              Log in to your Komenin workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {params.sso === "1" || params.sso === "invalid" ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                {params.sso === "invalid"
                  ? "SSO ticket was missing or expired. Continue with Google, or retry SSO from your IdP."
                  : "SSO ACS completed a dev ticket handoff. If you were not signed in automatically, continue with Google."}
              </p>
            ) : null}
            <form action={signInWithGoogle.bind(null, callbackUrl)}>
              <Button variant="electric"
                type="submit"
                className="w-full bg-electric-500 text-white shadow-[0_0_24px_rgba(46,124,246,0.35)] hover:bg-electric-600"
                size="lg"
              >
                Continue with Google
              </Button>
            </form>

            <div className="my-1 flex items-center gap-3">
              <Separator className="flex-1 bg-white/10" />
              <span className="text-xs text-neutral-500">or</span>
              <Separator className="flex-1 bg-white/10" />
            </div>

            <EmailOtpForm callbackUrl={callbackUrl} />
            <p className="text-center text-xs text-neutral-600">
              Enterprise SAML SSO is available for configured workspaces. Contact
              sales to enable it for your domain.
            </p>
            <Button
              variant="glass"
              className="w-full"
              render={<Link href="/" />}
              nativeButton={false}
            >
              Back to site
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
