"use client";

import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CardPageSkeleton } from "@/components/dashboard/card-grid-skeleton";

// One skeleton card per repo if they're cached (visited, or the org card was
// hovered, which prefetches them); else the default
export default function OrgLoading() {
  const { id } = useParams<{ id: string }>();
  const repos = useQueryClient().getQueryData<unknown[]>(["repositories", id]);
  return <CardPageSkeleton count={repos?.length} />;
}
