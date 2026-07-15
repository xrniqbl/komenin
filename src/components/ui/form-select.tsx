"use client";

import type React from "react";

import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FormSelectOption = {
  value: string;
  label: string;
};

type FormSelectProps = {
  id?: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  options: FormSelectOption[];
  className?: string;
};

export function FormSelect({
  id,
  name,
  defaultValue,
  required,
  disabled,
  placeholder = "Select an option",
  options,
  className,
}: FormSelectProps): React.ReactElement {
  return (
    <Select
      id={id}
      name={name}
      defaultValue={defaultValue}
      required={required}
      disabled={disabled}
      items={options}
    >
      <SelectTrigger className={cn("w-full min-w-0", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectPopup>
        {options.map((option) => (
          <SelectItem key={option.value || "__empty"} value={option.value} label={option.label}>
            {option.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}