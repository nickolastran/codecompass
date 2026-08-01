import { Skeleton } from "@/components/ui/skeleton";

export function TableOfContentsSkeleton() {
  return (
    <div className="w-64 border-l border-border flex flex-col bg-background hidden xl:flex">
      {/* Refresh button section */}
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Table of contents */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {/* "On this page" header */}
          <Skeleton className="h-4 w-20 mb-3" />

          {/* TOC items with varying indentation */}
          <div className="space-y-2">
            {/* Root level */}
            <Skeleton className="h-3 w-[75%]" />

            {/* Level 1 */}
            <Skeleton className="h-3 w-[70%]" style={{ paddingLeft: "12px" }} />
            <Skeleton className="h-3 w-[65%]" style={{ paddingLeft: "12px" }} />

            {/* Level 2 */}
            <Skeleton className="h-3 w-[60%]" style={{ paddingLeft: "24px" }} />
            <Skeleton className="h-3 w-[55%]" style={{ paddingLeft: "24px" }} />

            {/* Level 1 */}
            <Skeleton className="h-3 w-[68%]" style={{ paddingLeft: "12px" }} />

            {/* Root level */}
            <Skeleton className="h-3 w-[72%]" />

            {/* Level 1 */}
            <Skeleton className="h-3 w-[62%]" style={{ paddingLeft: "12px" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
