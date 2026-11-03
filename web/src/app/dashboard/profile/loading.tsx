import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// A card with a title skeleton and the given body
function SkeletonCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className={`h-5 ${title}`} />
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

// Label + input (+ optional button), like the profile form rows
function Field({ button = true }: { button?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1" />
        {button && <Skeleton className="h-9 w-16" />}
      </div>
    </div>
  );
}

export default function ProfileLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 py-10 px-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full shrink-0" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>
      <SkeletonCard title="w-20">
        <Field />
        <Field />
      </SkeletonCard>
      <SkeletonCard title="w-24">
        <Field button={false} />
        <Field button={false} />
        <Skeleton className="h-9 w-32" />
      </SkeletonCard>
      <SkeletonCard title="w-28">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      </SkeletonCard>
      <SkeletonCard title="w-40">
        <OrgRowsSkeleton />
      </SkeletonCard>
    </div>
  );
}

export function OrgRowsSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}
