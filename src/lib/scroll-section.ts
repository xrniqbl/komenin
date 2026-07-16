"use client";

const HEADER_OFFSET = 96;
const STORAGE_KEY = "aether.scrollTo";

export function scrollToSection(
  id: "features" | "pricing" | string,
  behavior: ScrollBehavior = "smooth",
) {
  const el = document.getElementById(id);
  if (!el) return false;
  const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  window.scrollTo({ top: Math.max(top, 0), behavior });
  return true;
}

export function rememberSection(id: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

export function consumeRememberedSection(): string | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (value) sessionStorage.removeItem(STORAGE_KEY);
    return value;
  } catch {
    return null;
  }
}
