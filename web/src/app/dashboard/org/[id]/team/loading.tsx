import { Skeleton } from "@/components/ui/skeleton";
import { MembersTableSkeleton } from "@/components/dashboard/organizations/membersTable";

export default function TeamLoading() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-8 w-36" />
      </div>
      <MembersTableSkeleton />
    </div>
  );
}
