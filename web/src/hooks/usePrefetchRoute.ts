"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getOrgMembers } from "@/lib/services/orgService";
import { getReposByOrganizationId } from "@/lib/services/repoService";

/**
 * Custom hook for prefetching routes and their associated data
 * Combines Next.js route prefetching with React Query data prefetching
 */
export function usePrefetchRoute() {
  const router = useRouter();
  const queryClient = useQueryClient();

  /**
   * Prefetch organization page (route + repos data)
   */
  const prefetchOrgPage = (orgId: string) => {
    // Prefetch the route bundle
    router.prefetch(`/dashboard/org/${orgId}`);

    // Prefetch repositories data
    queryClient.prefetchQuery({
      queryKey: ["repositories", orgId],
      queryFn: async () => {
        const result = await getReposByOrganizationId(orgId);
        if (!result.success) {
          throw new Error(result.error);
        }
        return result.data;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  };

  /**
   * Prefetch team page (route + members data)
   */
  const prefetchTeamPage = (orgId: string) => {
    // Prefetch the route bundle
    router.prefetch(`/dashboard/org/${orgId}/team`);

    // Prefetch members data
    queryClient.prefetchQuery({
      queryKey: ["members", orgId],
      queryFn: async () => {
        const result = await getOrgMembers(orgId);
        if (!result.success) {
          throw new Error(result.error);
        }
        return result.data;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  };

  /**
   * Prefetch organizations list page (route + orgs data)
   */
  const prefetchOrganizationsPage = () => {
    router.prefetch("/dashboard/organizations");
    // Orgs data is already prefetched by the page, so we just prefetch the route
  };

  /**
   * Prefetch repository page (route only)
   */
  const prefetchRepoPage = (repoId: string) => {
    // Prefetch the route bundle
    router.prefetch(`/dashboard/repo/${repoId}`);
    // TODO: Add data prefetching when repo page services are implemented
  };

  return {
    prefetchOrgPage,
    prefetchTeamPage,
    prefetchOrganizationsPage,
    prefetchRepoPage,
  };
}
