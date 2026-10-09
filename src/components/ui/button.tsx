"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium transition-all outline-none focus-visible:border-brand-500 focus-visible:ring-[3px] focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Neutral solid — token-based (light: neutral-950, dark: neutral-900).
        default:
          "bg-(--color-bg-primary-solid) text-(--color-text-primary_on-brand) shadow-xs hover:opacity-90",
        // Brand solid — canonical purple CTA (#7F56D9 → hover #6941C6).
        brand:
          "bg-(--color-bg-brand-solid) text-(--color-text-primary_on-brand) shadow-xs hover:bg-(--color-bg-brand-solid_hover)",
        destructive:
          "bg-(--color-bg-error-solid) text-white shadow-xs hover:bg-(--color-bg-error-solid_hover)",
        outline:
          "border border-(--color-border-primary) bg-(--color-bg-primary) text-(--color-text-secondary) shadow-xs hover:bg-(--color-bg-primary_hover) hover:text-(--color-text-primary)",
        secondary:
          "bg-(--color-bg-secondary) text-(--color-text-secondary) hover:bg-(--color-bg-secondary_hover) hover:text-(--color-text-primary)",
        ghost:
          "text-(--color-text-tertiary) hover:bg-(--color-bg-primary_hover) hover:text-(--color-text-primary)",
        link: "text-(--color-text-brand-tertiary) underline-offset-4 hover:text-(--color-text-brand-secondary_hover) hover:underline",
        // Marketing dark-glass theme (bg #0A0F1E): primary CTA + glass secondary.
        // Use these on marketing pages instead of `default`/`outline` so buttons
        // don't render as flat neutral-900 black against the blue-tinted bg.
        electric:
          "bg-electric-600 text-white shadow-[0_0_32px_rgba(46,124,246,0.45)] hover:bg-electric-500",
        glass:
          "border border-white/10 bg-[#0d1322] text-neutral-200 shadow-none hover:border-white/20 hover:bg-[#111827] hover:text-white",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        // WCAG 2.5.8 minimum touch target (24px CSS, ideally 44px).
        // size-11 icon buttons meet 44px; text buttons keep h-9 for layout.
        icon: "size-11",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>;

// Link-style composition: keep the host element's native semantics. Base UI
// Button with nativeButton={false} forces role="button", which incorrectly
// turns Next.js Link anchors into buttons for a11y queries. Extracted into its
// own component so `useRender` is always called unconditionally (rules-of-hooks).
function RenderedButton({
  classes,
  variant,
  size,
  render,
  ...props
}: {
  classes: string;
  variant: ButtonProps["variant"];
  size: ButtonProps["size"];
} & Omit<ButtonProps, "className" | "variant" | "size">): React.ReactElement {
  const defaultProps = {
    className: classes,
    "data-slot": "button",
    "data-variant": variant,
    "data-size": size,
  };

  return useRender({
    defaultTagName: "a",
    props: mergeProps(defaultProps, props as Record<string, unknown>),
    render: render as useRender.ComponentProps<"a">["render"],
  });
}

function Button({
  className,
  variant = "default",
  size = "default",
  render,
  nativeButton,
  ...props
}: ButtonProps): React.ReactElement {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (render != null && nativeButton === false) {
    return (
      <RenderedButton
        classes={classes}
        variant={variant}
        size={size}
        render={render}
        {...props}
      />
    );
  }

  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={classes}
      render={render}
      nativeButton={nativeButton}
      {...props}
    />
  );
}

export { Button, buttonVariants };