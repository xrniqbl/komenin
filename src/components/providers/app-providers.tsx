"use client";

import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delay={200}>
      <ToastProvider position="bottom-right">{children}</ToastProvider>
    </TooltipProvider>
  );
}
