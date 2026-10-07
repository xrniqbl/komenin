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
    <div className="bg-marketing relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 left-1/3 h-72 w-72 rounded-full bg-red-500/10 blur-[120px]" />
      </div>
      <div className="glass relative w-full max-w-md rounded-3xl p-8 text-center">
        <h1 className="text-2xl font-semibold text-white">Authentication error</h1>
        <p className="mt-2 text-sm text-neutral-400">
          {params.error || "Something went wrong during sign-in."}
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-electric-400 hover:text-electric-300">
          Back to login
        </Link>
      </div>
    </div>
  );
}
