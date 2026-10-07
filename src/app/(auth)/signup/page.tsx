import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { signInWithGoogle } from "@/server/auth-actions";

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect("/onboarding");

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
            <CardTitle className="text-2xl text-white">Create your workspace</CardTitle>
            <CardDescription className="text-neutral-400">
              Sign up with Google, then invite your team.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form action={signInWithGoogle.bind(null, "/onboarding")}>
              <Button
                type="submit"
                className="w-full bg-electric-500 text-white shadow-[0_0_24px_rgba(46,124,246,0.35)] hover:bg-electric-600"
                size="lg"
              >
                Continue with Google
              </Button>
            </form>
            <p className="text-center text-xs text-neutral-500">
              If the button fails after a hot reload, use{" "}
              <Link
                href="/api/auth/signin/google?callbackUrl=%2Fonboarding"
                className="font-medium text-neutral-300 underline underline-offset-4 hover:text-white"
              >
                this direct Google sign-in link
              </Link>
              .
            </p>
            <Button
              variant="outline"
              className="w-full"
              render={<Link href="/login" />}
              nativeButton={false}
            >
              Already have an account?
            </Button>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-neutral-600">
          By signing up you agree to our{" "}
          <Link href="/legal/terms" className="underline hover:text-neutral-400">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="underline hover:text-neutral-400">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
