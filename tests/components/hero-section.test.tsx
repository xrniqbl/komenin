import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroSection } from "@/components/marketing/hero-section";

describe("HeroSection", () => {
  it("renders product thesis and primary cta", () => {
    render(<HeroSection />);
    expect(
      screen.getByRole("heading", {
        name: /operate social engagement with enterprise control/i,
      }),
    ).toBeInTheDocument();

    const cta = screen.getByRole("link", { name: /start free/i });
    expect(cta).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("link", { name: /book demo/i })).toHaveAttribute(
      "href",
      "/contact",
    );
  });
});