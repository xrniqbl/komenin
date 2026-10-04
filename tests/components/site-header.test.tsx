import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/components/i18n/locale-provider";
import { SiteHeader } from "@/components/marketing/site-header";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push, refresh }),
}));

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = "en";
  push.mockReset();
  refresh.mockReset();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.lang = "en";
});

function renderHeader() {
  return render(
    <LocaleProvider>
      <SiteHeader />
    </LocaleProvider>,
  );
}

describe("SiteHeader", () => {
  it("renders desktop navigation links and language toggle", () => {
    renderHeader();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    // Features/Pricing are crawlable links to their indexable pages (they
    // only scroll-to-section when already on the homepage).
    expect(screen.getByRole("link", { name: "Features" })).toHaveAttribute("href", "/features");
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Enterprise" })).toHaveAttribute("href", "/enterprise");
    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute("href", "/security");
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/docs");
    // Platform dropdown groups the newer marketing pages behind one trigger.
    expect(screen.getByRole("button", { name: /platform/i })).toBeInTheDocument();
    expect(screen.getAllByRole("group", { name: "Language" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "EN" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "ID" }).length).toBeGreaterThan(0);
  });

  it("switches navbar labels to Indonesian", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getAllByRole("button", { name: "ID" })[0]!);
    // LocaleLink prefixes the /id locale path for routed links (Docs stays
    // a plain /docs link in this header).
    expect(screen.getByRole("link", { name: "Fitur" })).toHaveAttribute("href", "/id/features");
    expect(screen.getByRole("link", { name: "Harga" })).toHaveAttribute("href", "/id/pricing");
    expect(screen.getByRole("link", { name: "Dokumentasi" })).toHaveAttribute("href", "/docs");
  });

  it("opens mobile menu sheet", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole("button", { name: /open menu|buka menu/i }));
    const mobileNav = await screen.findByRole("navigation", { name: "Mobile" });
    expect(mobileNav).toBeInTheDocument();
    expect(within(mobileNav).getByRole("link", { name: /pricing|harga/i })).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(
      within(mobileNav).getByRole("link", { name: /docs|dokumentasi/i }),
    ).toHaveAttribute("href", "/docs");
    // New marketing pages are grouped in the mobile menu too.
    expect(within(mobileNav).getByRole("link", { name: "Instagram" })).toHaveAttribute(
      "href",
      "/platform/instagram",
    );
    expect(within(mobileNav).getByRole("link", { name: /changelog/i })).toHaveAttribute(
      "href",
      "/changelog",
    );
  });
});
