"use server";

import { signIn } from "@/lib/auth";

export async function signInWithGoogle(redirectTo = "/onboarding") {
  // Auth.js will throw a NEXT_REDIRECT to Google; do not catch it.
  await signIn("google", { redirectTo });
}