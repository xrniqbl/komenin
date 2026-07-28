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
    expect(screen.getByRole("button", { name: "Features" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pricing" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enterprise" })).toHaveAttribute("href", "/enterprise");
    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute("href", "/security");
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/docs");
    expect(screen.getAllByRole("group", { name: "Language" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "EN" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "ID" }).length).toBeGreaterThan(0);
  });

  it("switches navbar labels to Indonesian", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getAllByRole("button", { name: "ID" })[0]!);
    expect(screen.getByRole("button", { name: "Fitur" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Harga" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dokumentasi" })).toHaveAttribute("href", "/docs");
  });

  it("opens mobile menu sheet", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole("button", { name: /open menu|buka menu/i }));
    const mobileNav = await screen.findByRole("navigation", { name: "Mobile" });
    expect(mobileNav).toBeInTheDocument();
    expect(within(mobileNav).getByRole("button", { name: /pricing|harga/i })).toBeInTheDocument();
    expect(
      within(mobileNav).getByRole("link", { name: /docs|dokumentasi/i }),
    ).toHaveAttribute("href", "/docs");
  });
});
