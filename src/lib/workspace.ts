export function slugifyWorkspaceName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function buildUniqueSlugCandidate(base: string, attempt: number): string {
  if (attempt <= 0) return base;
  return `${base}-${attempt + 1}`.slice(0, 48);
}
