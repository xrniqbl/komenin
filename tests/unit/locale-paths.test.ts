import { describe, expect, it } from "vitest";
import {
  alternateLocalePath,
  isPrefixablePath,
  splitLocalePath,
  withLocalePath,
} from "@/lib/i18n/paths";

describe("isPrefixablePath", () => {
  it("allows public marketing pages", () => {
    expect(isPrefixablePath("/")).toBe(true);
    expect(isPrefixablePath("/pricing")).toBe(true);
    expect(isPrefixablePath("/features/session-routing")).toBe(true);
    expect(isPrefixablePath("/docs/tutorial/introduction")).toBe(true);
    expect(isPrefixablePath("/legal/privacy")).toBe(true);
    expect(isPrefixablePath("/login")).toBe(true);
    expect(isPrefixablePath("/signup")).toBe(true);
  });

  it("rejects private/api/asset paths", () => {
    expect(isPrefixablePath("/api/v1/accounts")).toBe(false);
    expect(isPrefixablePath("/admin")).toBe(false);
    expect(isPrefixablePath("/app/campaigns")).toBe(false);
    expect(isPrefixablePath("/_next/static/app.js")).toBe(false);
    expect(isPrefixablePath("/onboarding")).toBe(false);
    expect(isPrefixablePath("/invite/abc123")).toBe(false);
    expect(isPrefixablePath("/sw.js")).toBe(false);
    expect(isPrefixablePath("/robots.txt")).toBe(false);
    expect(isPrefixablePath("/sitemap.xml")).toBe(false);
    expect(isPrefixablePath("/brand/komenin-logo.png")).toBe(false);
    expect(isPrefixablePath("/manifest.webmanifest")).toBe(false);
  });
});

describe("splitLocalePath", () => {
  it("treats unprefixed paths as EN", () => {
    expect(splitLocalePath("/pricing")).toEqual({ locale: "en", path: "/pricing" });
    expect(splitLocalePath("/")).toEqual({ locale: "en", path: "/" });
  });

  it("extracts the ID locale and unprefixed path", () => {
    expect(splitLocalePath("/id/pricing")).toEqual({ locale: "id", path: "/pricing" });
    expect(splitLocalePath("/id/features/session-routing")).toEqual({
      locale: "id",
      path: "/features/session-routing",
    });
  });

  it("maps the bare /id prefix to the homepage", () => {
    expect(splitLocalePath("/id")).toEqual({ locale: "id", path: "/" });
    expect(splitLocalePath("/id/")).toEqual({ locale: "id", path: "/" });
  });

  it("leaves non-prefixed /id…-like app paths alone", () => {
    // /ideas is a normal EN page, not an ID prefix
    expect(splitLocalePath("/ideas")).toEqual({ locale: "en", path: "/ideas" });
  });
});

describe("withLocalePath", () => {
  it("returns EN paths unchanged", () => {
    expect(withLocalePath("en", "/pricing")).toBe("/pricing");
  });

  it("prefixes ID paths", () => {
    expect(withLocalePath("id", "/pricing")).toBe("/id/pricing");
    expect(withLocalePath("id", "/")).toBe("/id");
  });

  it("never prefixes private paths", () => {
    expect(withLocalePath("id", "/api/v1/accounts")).toBe("/api/v1/accounts");
    expect(withLocalePath("id", "/app/campaigns")).toBe("/app/campaigns");
  });
});

describe("alternateLocalePath", () => {
  it("switches EN → ID", () => {
    expect(alternateLocalePath("/pricing", "id")).toBe("/id/pricing");
    expect(alternateLocalePath("/", "id")).toBe("/id");
  });

  it("switches ID → EN", () => {
    expect(alternateLocalePath("/id/pricing", "en")).toBe("/pricing");
    expect(alternateLocalePath("/id", "en")).toBe("/");
  });

  it("keeps deep paths intact", () => {
    expect(alternateLocalePath("/features/comment-engine", "id")).toBe(
      "/id/features/comment-engine",
    );
    expect(alternateLocalePath("/id/features/comment-engine", "en")).toBe(
      "/features/comment-engine",
    );
  });
});
