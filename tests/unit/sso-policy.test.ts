import { afterEach, describe, expect, it } from "vitest";
import { isSsoLoginEnforced } from "@/lib/sso-policy";

const original = process.env.SSO_ENFORCE_LOGIN;

afterEach(() => {
  if (original === undefined) delete process.env.SSO_ENFORCE_LOGIN;
  else process.env.SSO_ENFORCE_LOGIN = original;
});

describe("sso-policy", () => {
  it("defaults SSO login enforcement to off", () => {
    delete process.env.SSO_ENFORCE_LOGIN;
    expect(isSsoLoginEnforced()).toBe(false);
  });

  it("reads SSO_ENFORCE_LOGIN flag", () => {
    process.env.SSO_ENFORCE_LOGIN = "true";
    expect(isSsoLoginEnforced()).toBe(true);
  });
});
