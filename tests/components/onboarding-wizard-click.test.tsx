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
    // fixed root cause: 16x16 artwork must keep its own viewBox,
    // otherwise it renders ~2/3 size inside MUI 24x24 box
    expect(svg?.getAttribute("viewBox")).toBe("0 0 16 16");
    expect(svg?.getAttribute("class")).toMatch(/size-7/);
  });
});
