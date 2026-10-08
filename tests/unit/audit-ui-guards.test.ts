import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("audit UI guardrails", () => {
  it("syncs filter text after URL navigation", () => {
    expect(source("src/components/app/filter-bar.tsx")).toMatch(/setQ\(searchParams\.get\(queryParam\) \?\? ""\)/);
  });
  it("prevents published posts being dragged and announces reschedule failures", () => {
    const calendar = source("src/components/content/content-calendar.tsx");
    expect(calendar).toContain('draggable={item.status !== "published"}');
    expect(calendar).toContain('role="alert"');
  });
  it("uses safe local login callbacks for both sign-in methods", () => {
    const login = source("src/app/(auth)/login/page.tsx");
    expect(login).toContain('params.callbackUrl');
    expect(login).toContain('callbackUrl={callbackUrl}');
    expect(login).toContain('signInWithGoogle.bind(null, callbackUrl)');
  });
  it("labels the signup CTA honestly and provides email prefill", () => {
    expect(source("src/components/marketing/site-footer.tsx")).toContain('Create an account');
    expect(source("src/app/(auth)/signup/page.tsx")).toContain('initialEmail={email}');
    expect(source("src/components/auth/email-otp-form.tsx")).toContain('useState(initialEmail)');
    expect(source("src/components/marketing/hero-section.tsx")).toContain('Explore features');
  });
  it("makes status buckets perceivable by assistive technology", () => {
    expect(source("src/app/(marketing)/status/page.tsx")).toContain('role="img"');
    expect(source("src/app/(marketing)/status/page.tsx")).toContain('aria-label={`${b.date}: ${b.uptime}% uptime`}');
  });
});
