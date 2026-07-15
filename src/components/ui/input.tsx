"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 data-[size=sm]:h-8 data-[size=sm]:px-2.5 data-[size=sm]:text-sm data-[size=lg]:h-10 data-[size=lg]:px-3.5",
  {
    variants: {
      size: {
        default: "",
        sm: "",
        lg: "",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

type InputSize = NonNullable<VariantProps<typeof inputVariants>["size"]> | number;

export type InputProps = Omit<InputPrimitive.Props, "size"> & {
  size?: InputSize;
  unstyled?: boolean;
  nativeInput?: boolean;
  type?: React.HTMLInputTypeAttribute;
};

function Input({
  className,
  type,
  size = "default",
  unstyled = false,
  nativeInput = false,
  ...props
}: InputProps): React.ReactElement {
  const dataSize = typeof size === "string" ? size : undefined;
  const htmlSize = typeof size === "number" ? size : undefined;

  return (
    <InputPrimitive
      type={type}
      size={htmlSize}
      data-slot={nativeInput ? "input" : "input"}
      data-size={dataSize}
      className={cn(!unstyled && inputVariants({ size: dataSize }), className)}
      {...props}
    />
  );
}

export { Input, inputVariants };