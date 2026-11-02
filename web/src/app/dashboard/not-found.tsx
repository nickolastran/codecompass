import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";

export default function DashboardNotFound() {
  return (
    <Empty
      icon={<SearchX className="h-6 w-6 text-muted-foreground" />}
      title="Not found"
      description="This page doesn't exist, or you don't have access to it."
    >
      <Button variant="outline" asChild>
        <Link href="/dashboard/organizations">Back to organizations</Link>
      </Button>
    </Empty>
  );
}
