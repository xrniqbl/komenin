import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "@/components/app/onboarding-wizard";

function renderGoalsStep() {
  const completeOnboarding = vi.fn(async () => {});
  render(
    <OnboardingWizard
      completeOnboarding={completeOnboarding}
      initialStep="goals"
      urlData={{
        workspaceName: "Acme",
        timezone: "Asia/Jakarta",
        invites: "",
        goals: "",
        platforms: "",
        templateId: "",
      }}
    />,
  );
  return { completeOnboarding };
}

describe("OnboardingWizard goals step clickability", () => {
  it("toggles a goal card on click", async () => {
    const user = userEvent.setup();
    renderGoalsStep();
    const card = screen.getByRole("button", { name: /boost engagement/i });
    await user.click(card);
    // selected state: border-electric-500/50 + pressed
    expect(card.className).toMatch(/border-electric-500\/50/);
    expect(card).toHaveAttribute("aria-pressed", "true");
    // toggle off again
    await user.click(card);
    expect(card.className).not.toMatch(/border-electric-500\/50/);
  });

  it("toggles a platform card on click", async () => {
    const user = userEvent.setup();
    renderGoalsStep();
    const threads = screen.getByRole("button", { name: /threads/i });
    await user.click(threads);
    expect(threads.className).toMatch(/border-electric-500\/50/);
  });

  it("enables Continue only after goal + platform selected", async () => {
    const user = userEvent.setup();
    renderGoalsStep();
    const next = screen.getByRole("button", { name: /continue/i });
    // nothing selected -> must stay disabled
    expect(next).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /boost engagement/i }));
    // goal only -> still disabled (platform required)
    expect(next).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /threads/i }));
    expect(next).not.toBeDisabled();
  });

  it("renders Threads glyph at same box size as Instagram/TikTok", async () => {
    renderGoalsStep();
    const threads = screen.getByRole("button", { name: /threads/i });
    const svg = threads.querySelector("svg");
    expect(svg).not.toBeNull();
    // Threads artwork (16x16) is normalized into a 24x24 viewBox with 2u
    // padding — the same ink box as the MUI Instagram/TikTok icons — and
    // carries an explicit 28px size so MUI's SvgIcon CSS can't shrink it.
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("class")).toMatch(/size-7/);
    expect(svg?.getAttribute("style")).toMatch(/28px/);
  });

  it("fills the selection circle with a fitting check when a card is picked", async () => {
    const user = userEvent.setup();
    renderGoalsStep();
    const threads = screen.getByRole("button", { name: /threads/i });
    await user.click(threads);
    const indicator = threads.querySelector("span.absolute");
    expect(indicator?.className).toMatch(/bg-electric-500/);
    const check = indicator?.querySelector("svg");
    expect(check).not.toBeNull();
    // 10px check inside the 16px platform circle (no overflow)
    expect(check?.getAttribute("style")).toMatch(/10px/);

    const goal = screen.getByRole("button", { name: /boost engagement/i });
    await user.click(goal);
    const goalCheck = goal.querySelector("span.mt-0\\.5 svg, span svg");
    expect(goalCheck).not.toBeNull();
    // 12px check inside the 20px goal circle (no overflow)
    expect(goalCheck?.getAttribute("style")).toMatch(/12px/);
  });
});
