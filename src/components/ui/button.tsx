"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium transition-all outline-none focus-visible:border-neutral-400 focus-visible:ring-[3px] focus-visible:ring-neutral-400/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Use solid utility colors so CTAs remain visible even if CSS vars fail.
        default: "bg-neutral-900 text-white hover:bg-neutral-800",
        destructive: "bg-red-600 text-white hover:bg-red-500",
        outline:
          "border border-neutral-300 bg-white text-neutral-900 shadow-xs hover:bg-neutral-50",
        secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
        ghost: "text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900",
        link: "text-neutral-900 underline-offset-4 hover:underline",
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