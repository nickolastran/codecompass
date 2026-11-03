"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CardPageSkeleton } from "@/components/dashboard/card-grid-skeleton";

// One skeleton card per org if we've loaded the list before; else the default
export default function OrganizationsLoading() {
  const orgs = useQueryClient().getQueryData<unknown[]>(["organizations"]);
  return <CardPageSkeleton count={orgs?.length} />;
}
