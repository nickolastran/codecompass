import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { getReposByOrganizationId } from "@/lib/services/repoService";
import { Repo } from "@/app/types/supabase";
import { redirect } from "next/navigation";
import { RepoList } from "@/components/dashboard/repos/list";
import OrgHeader from "@/components/dashboard/repos/org-header";
import { NavbarContextSetter } from "@/components/dashboard/navbar-context-setter";
import { prefetchOrgData } from "@/lib/services/orgCache";

export default async function OrgPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const queryClient = new QueryClient();

  // Fetch org access and details in parallel (with caching)
  // User auth is handled by layout, getUser() called internally
  const orgData = await prefetchOrgData(id, queryClient);

  if (!orgData.access) {
    console.error("Organization not found or access denied");
    redirect("/dashboard/organizations");
  }

  // Prefetch repositories
  await queryClient.prefetchQuery({
    queryKey: ["repositories", id],
    queryFn: async () => {
      const result = await getReposByOrganizationId(id);
      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data as Repo[];
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NavbarContextSetter
        breadcrumbs={[
          { label: "Organizations", href: "/dashboard/organizations" },
          { label: orgData.details?.name || "Organization" },
        ]}
      />
      <div className="container mx-auto py-8 px-4">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8">
          <OrgHeader orgName={orgData.details?.name || "Organization"} />
          <Button variant="default" size="sm">
            <Link href={`/dashboard/new/${id}`} prefetch={true}>
              <div className="flex items-center gap-1">
                <Plus />
                <span>New repository</span>
              </div>
            </Link>
          </Button>
        </div>
        <RepoList organizationId={orgData.access.organizationId} />
      </div>
    </HydrationBoundary>
  );
}
