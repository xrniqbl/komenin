import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
}));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

import { AppSidebar } from "@/components/app/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

describe("AppSidebar", () => {
  it("renders core navigation groups", () => {
    render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    );
    expect(screen.getByText(/command center/i)).toBeInTheDocument();
    expect(screen.getByText(/session routing/i)).toBeInTheDocument();
    expect(screen.getByText(/automation/i)).toBeInTheDocument();
    expect(screen.getByText(/intelligence/i)).toBeInTheDocument();
  });

  it("renders new feature nav items", () => {
    render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    );
    // Phase 2+ features
    expect(screen.getByText(/templates/i)).toBeInTheDocument();
    expect(screen.getByText(/competitor radar|radar/i)).toBeInTheDocument();
    expect(screen.getByText(/rate limits/i)).toBeInTheDocument();
  });
});
