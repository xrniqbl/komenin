import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormSelect } from "@/components/ui/form-select";

describe("FormSelect", () => {
  it("renders a named select trigger for forms", () => {
    render(
      <FormSelect
        name="platform"
        defaultValue="instagram"
        options={[
          { value: "instagram", label: "Instagram" },
          { value: "threads", label: "Threads" },
        ]}
      />,
    );

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    // Base UI select keeps a hidden input for form submission
    const hidden = document.querySelector('input[name="platform"]');
    expect(hidden).not.toBeNull();
    expect(hidden).toHaveAttribute("value", "instagram");
  });
});