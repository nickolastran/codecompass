import { Skeleton } from "@/components/ui/skeleton";

export function FileTreeSkeleton() {
  return (
    <div className="w-64 border-r border-border flex flex-col bg-background h-full hidden lg:flex">
      {/* Last indexed section */}
      <div className="p-3 border-b border-border">
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Search bar */}
      <div className="p-2 border-b border-border">
        <Skeleton className="h-8 w-full rounded" />
      </div>

      {/* File tree items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* Root level items */}
        <Skeleton className="h-6 w-[85%]" style={{ paddingLeft: "8px" }} />
        <Skeleton className="h-6 w-[70%]" style={{ paddingLeft: "8px" }} />

        {/* Level 1 indented */}
        <Skeleton className="h-6 w-[80%]" style={{ paddingLeft: "20px" }} />
        <Skeleton className="h-6 w-[75%]" style={{ paddingLeft: "20px" }} />

        {/* Level 2 indented */}
        <Skeleton className="h-6 w-[70%]" style={{ paddingLeft: "32px" }} />
        <Skeleton className="h-6 w-[65%]" style={{ paddingLeft: "32px" }} />

        {/* Root level items */}
        <Skeleton className="h-6 w-[90%]" style={{ paddingLeft: "8px" }} />

        {/* Level 1 indented */}
        <Skeleton className="h-6 w-[75%]" style={{ paddingLeft: "20px" }} />
        <Skeleton className="h-6 w-[60%]" style={{ paddingLeft: "20px" }} />

        {/* More root items */}
        <Skeleton className="h-6 w-[80%]" style={{ paddingLeft: "8px" }} />
      </div>
    </div>
  );
}
