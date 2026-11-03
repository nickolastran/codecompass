import { Skeleton } from "@/components/ui/skeleton";

// Matches the repo/org card grid (cards are min-h-21)
export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-21 w-full" />
      ))}
    </div>
  );
}

// Matches the org / organizations page: title + "New …" button, then the grid
export function CardPageSkeleton({ count }: { count?: number }) {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-36" />
      </div>
      <CardGridSkeleton count={count} />
    </div>
  );
}
