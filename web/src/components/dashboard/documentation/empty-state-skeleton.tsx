import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the <Empty> "No documentation / Indexing failed" layout
export function EmptyStateSkeleton() {
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="flex flex-col items-center py-12">
        <Skeleton className="h-12 w-12 rounded-lg mb-3" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-96 max-w-[80vw] mt-3" />
        <Skeleton className="h-9 w-36 mt-6" />
      </div>
    </div>
  );
}
