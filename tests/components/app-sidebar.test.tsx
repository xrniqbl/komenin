import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
}));

import { AppSidebar } from "@/components/app/app-sidebar";

describe("AppSidebar", () => {
  it("renders core navigation groups", () => {
    render(<AppSidebar />);
    expect(screen.getByText(/command center/i)).toBeInTheDocument();
    expect(screen.getByText(/session routing/i)).toBeInTheDocument();
    expect(screen.getByText(/automation/i)).toBeInTheDocument();
    expect(screen.getByText(/intelligence/i)).toBeInTheDocument();
  });
});
