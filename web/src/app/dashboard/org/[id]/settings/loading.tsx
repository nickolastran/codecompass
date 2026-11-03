import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Also rendered by the settings page while it fetches the org
export default function OrgSettingsLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-8 py-12">
      <Skeleton className="h-9 w-72" />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="h-9 w-16" />
        </CardContent>
      </Card>
    </div>
  );
}
