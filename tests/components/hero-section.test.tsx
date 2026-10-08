import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { HeroSection } from "@/components/marketing/hero-section";

describe("HeroSection", () => {
  it("renders centered product thesis and primary actions", () => {
    render(
      <LocaleProvider>
        <HeroSection />
      </LocaleProvider>,
    );
    expect(
      screen.getByRole("heading", {
        name: /run comments and auto posts with enterprise control/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start free/i })).toHaveAttribute(
      "href",
      "/signup",
    );
    expect(screen.getByRole("link", { name: /explore features/i })).toHaveAttribute(
      "href",
      "/features",
    );
    expect(screen.queryByText(/today.?s ops snapshot/i)).not.toBeInTheDocument();
  });
});