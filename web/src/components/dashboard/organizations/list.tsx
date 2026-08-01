"use client";

import { useQuery } from "@tanstack/react-query";
import { OrganizationWithRole } from "@/app/types/supabase";
import { OrganizationButton } from "./card";
import { getOrgs } from "@/lib/services/orgService";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, Plus } from "lucide-react";

export function OrganizationList() {
  const { data, isLoading, error } = useQuery<OrganizationWithRole[]>({
    queryKey: ["organizations"],
    queryFn: async () => {
      const result = await getOrgs();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data as OrganizationWithRole[];
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-destructive">Error: {error.message}</div>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center">
        <Empty
          title="You Have No Organizations"
          description="Create or join an organization to get started"
          icon={<Users className="w-6 h-6 text-muted-foreground" />}
        >
          <Button variant="default" size="sm">
            <Link href={`/dashboard/new`}>
              <div className="flex items-center gap-1">
                <Plus />
                <span>New organization</span>
              </div>
            </Link>
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      {data.map((organization) => (
        <OrganizationButton key={organization.id} organization={organization} />
      ))}
    </div>
  );
}
