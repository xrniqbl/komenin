import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Authentication error",
  robots: { index: false, follow: false },
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold">Authentication error</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {params.error || "Something went wrong during sign-in."}
      </p>
      <Link href="/login" className="mt-6 text-sm font-medium text-primary">
        Back to login
      </Link>
    </div>
  );
}
