"use client";

import { useQuery } from "@tanstack/react-query";
import { Repo } from "@/app/types/supabase";
import { getReposByOrganizationId } from "@/lib/services/repoService";
import { RepoButton } from "./card";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FolderPlus, Plus } from "lucide-react";

type RepoListProps = {
  organizationId: string;
};

export function RepoList({ organizationId }: RepoListProps) {
  const { data, isLoading, error } = useQuery<Repo[]>({
    queryKey: ["repositories", organizationId],
    queryFn: async () => {
      const result = await getReposByOrganizationId(organizationId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data as Repo[];
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-destructive"> Error: {error.message} </div>;
  }

  if (!data || data.length === 0) {
    //where i'm gonna add the empty
    // for /dashboard/new/${id} , figure out how to get the id
    return (
      <div className="flex justify-center items-center">
        <Empty
          title="You Have No Repositories"
          description="Index a repository to get started"
          icon={<FolderPlus className="w-6 h-6 text-muted-foreground" />}
        >
          <Button variant="default" size="sm">
            <Link href={`/dashboard/new/${organizationId}`}>
              <div className="flex items-center gap-1">
                <Plus />
                <span>New repository</span>
              </div>
            </Link>
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      {data.map((repo) => (
        <RepoButton key={repo.id} repo={repo} />
      ))}
    </div>
  );
}
