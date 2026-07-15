import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth, signIn } from "@/lib/auth";

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect("/onboarding");

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Create your Aether workspace</CardTitle>
          <CardDescription>Sign up with Google, then invite your team.</CardDescription>
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
          <Button variant="ghost" render={<Link href="/login" />} nativeButton={false}>
            Already have an account?
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
