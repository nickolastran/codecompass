"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  console.error(error);

  return (
    <Empty
      icon={<AlertTriangle className="h-6 w-6 text-destructive" />}
      title="Something went wrong"
      description="This page failed to load. Try again, or head back to your organizations."
    >
      <div className="flex gap-3">
        <Button onClick={() => unstable_retry()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/organizations">Organizations</Link>
        </Button>
      </div>
    </Empty>
  );
}
