"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { consumeRememberedSection, scrollToSection } from "@/lib/scroll-section";

/**
 * After navigating back to home from another page, scroll to a remembered section
 * without putting a hash in the URL.
 */
export function HomeSectionScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;
    const id = consumeRememberedSection();
    if (!id) return;
    // Wait for paint so section positions are correct.
    const timer = window.setTimeout(() => {
      scrollToSection(id, "smooth");
    }, 50);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
