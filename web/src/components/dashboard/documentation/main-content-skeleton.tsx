import { Skeleton } from "@/components/ui/skeleton";

export function MainContentSkeleton() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b border-grey-800 px-6 py-3 flex items-center justify-between">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-8 w-40" />
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto bg-grey-950">
        <div className="max-w-full lg:max-w-4xl mx-4 md:mx-8 lg:ml-24 lg:mr-8 py-8 space-y-6">
          {/* H1 Title */}
          <Skeleton className="h-9 w-3/4" />

          {/* Paragraph block 1 */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[95%]" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[70%]" />
          </div>

          {/* H2 Heading */}
          <Skeleton className="h-8 w-2/3 mt-10" />

          {/* Paragraph block 2 */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[92%]" />
            <Skeleton className="h-4 w-[85%]" />
          </div>

          {/* Code block */}
          <Skeleton className="h-32 w-full bg-grey-800 border border-grey-700" />

          {/* H3 Heading */}
          <Skeleton className="h-7 w-1/2 mt-8" />

          {/* Paragraph block 3 */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[88%]" />
            <Skeleton className="h-4 w-[95%]" />
            <Skeleton className="h-4 w-[75%]" />
          </div>

          {/* List items */}
          <div className="space-y-2 ml-4">
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[85%]" />
            <Skeleton className="h-4 w-[80%]" />
          </div>

          {/* H3 Heading */}
          <Skeleton className="h-7 w-[55%] mt-8" />

          {/* Paragraph block 4 */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[93%]" />
          </div>
        </div>
      </div>
    </div>
  );
}
