/**
 * Shared GSAP setup for the marketing landing page.
 *
 * Plugins are registered once here; every animated marketing component
 * imports { gsap, ScrollTrigger, SplitText } from this module instead of
 * registering plugins itself.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

// Registrasi plugin hanya di browser yang mendukung matchMedia.
// Di SSR / jsdom tanpa matchMedia, registrasi ScrollTrigger memanggil
// window.matchMedia saat load dan crash — jadi harus dijaga.
const canUseDom =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function";

if (canUseDom) {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

/** True when the OS asks for reduced motion — animations should be skipped. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    // SSR / jsdom tanpa matchMedia: lewati animasi agar render tetap deterministik.
    return true;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export { gsap, ScrollTrigger, SplitText };
