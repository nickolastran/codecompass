import { Button } from "@/components/ui/button";
import { Plus } from "@geist-ui/icons";
import { QueryClient } from "@tanstack/react-query";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { OrganizationList } from "@/components/dashboard/organizations/list";
import Link from "next/link";
import { getOrgs } from "@/lib/services/orgService";
import { NavbarContextSetter } from "@/components/dashboard/navbar-context-setter";

export default async function OrganizationsPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const result = await getOrgs();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NavbarContextSetter contextText="Organizations" />
      <div className="container mx-auto py-8 px-4">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl text-foreground">Your Organizations</h1>
          <Button variant="default" size="sm">
            <Link href="/dashboard/new" prefetch={true}>
              <div className="flex items-center gap-1">
                <Plus />
                <span>New organization</span>
              </div>
            </Link>
          </Button>
        </div>

        {/* Organizations Grid */}
        <OrganizationList />
      </div>
    </HydrationBoundary>
  );
}
