import LoopRoundedIcon from '@mui/icons-material/LoopRounded';

import type React from "react";
import { cn } from "@/lib/utils";

export function Spinner({
  className,
  ...props
}: React.ComponentProps<typeof LoopRoundedIcon>): React.ReactElement {
  return (
    <LoopRoundedIcon
      aria-label="Loading"
      className={cn("animate-spin", className)}
      role="status"
      {...props}
    />
  );
}
