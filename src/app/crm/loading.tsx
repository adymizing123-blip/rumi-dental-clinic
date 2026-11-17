import { Skeleton } from "@/components/ui-skeleton";

/** Shown while a CRM page loads. */
export default function Loading() {
  return (
    <div className="space-y-6 p-6" aria-busy="true">
      <Skeleton className="h-10 w-64 rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
