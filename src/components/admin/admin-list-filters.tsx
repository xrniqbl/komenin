import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * GET-form filter bar for admin list pages — plain navigation, no client JS:
 * submitting reloads the page with ?q=&status=&page cleared by the browser.
 */
export function AdminListFilters({
  q,
  status,
  statusOptions,
  placeholder = "Cari…",
}: {
  q?: string;
  status?: string;
  statusOptions?: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <form method="get" className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        className="max-w-xs"
      />
      {statusOptions ? (
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none"
        >
          <option value="">Semua status</option>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}
      <Button type="submit" variant="glass" size="sm">
        Terapkan
      </Button>
    </form>
  );
}
