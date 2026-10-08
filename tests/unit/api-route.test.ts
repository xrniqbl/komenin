import { describe, expect, it } from "vitest";
import { REDIRECT_ERROR_CODE } from "next/dist/client/components/redirect-error";
import { jsonErrorFromUnknown } from "@/lib/api-route";

function makeRedirectError(url: string) {
  const error = new Error(REDIRECT_ERROR_CODE) as Error & { digest: string };
  // Matches next/dist/client/components/redirect.js getRedirectError()
  error.digest = `${REDIRECT_ERROR_CODE};replace;${url};307;`;
  return error;
}

describe("jsonErrorFromUnknown", () => {
  it("maps login redirect to 401 Unauthorized", async () => {
    const response = jsonErrorFromUnknown(makeRedirectError("/login"), "fail");
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  });

  it("maps onboarding redirect to 403 workspace required", async () => {
    const response = jsonErrorFromUnknown(makeRedirectError("/onboarding"), "fail");
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Workspace required",
      code: "WORKSPACE_REQUIRED",
    });
  });

  it("maps not-found messages to 404", async () => {
    const response = jsonErrorFromUnknown(new Error("Voucher not found"), "fail");
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "Voucher not found",
      code: "NOT_FOUND",
    });
  });

  it("attaches a stable code to generic fallbacks", async () => {
    const response = jsonErrorFromUnknown(new Error("boom"), "fail", 500);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "fail",
      code: "INTERNAL_ERROR",
    });
  });
});
