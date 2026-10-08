import { Skeleton } from "@/components/ui/skeleton";

export default function DocsLoading() {
  return (
    <div className="flex-1 space-y-4 px-4 py-8 md:px-8">
      <Skeleton className="h-8 w-64 rounded-full bg-white/5" />
      <Skeleton className="h-4 w-96 rounded-full bg-white/5" />
      <Skeleton className="h-40 w-full rounded-2xl border border-white/10 bg-white/5" />
      <Skeleton className="h-40 w-full rounded-2xl border border-white/10 bg-white/5" />
    </div>
  );
}
