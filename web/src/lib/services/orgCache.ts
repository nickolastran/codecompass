"use server";

import { QueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/server";
import { Organization } from "@/app/types/supabase";
import { ActionResult } from "@/app/types/action";

type OrgAccessData = {
  organizationId: string;
  role: string;
  hasAccess: boolean;
};

type OrgDataBundle = {
  access: OrgAccessData | null;
  details: Organization | null;
};

/**
 * Prefetch organization data (access check + details) in parallel
 * Caches results in React Query for reuse across pages
 * Gets user from Supabase session to avoid duplicate auth calls
 */
export async function prefetchOrgData(
  orgId: string,
  queryClient: QueryClient,
): Promise<OrgDataBundle> {
  const supabase = await createClient();

  // Get user from session (already authenticated by layout)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { access: null, details: null };
  }

  // Fetch access check and org details in parallel
  const [accessResult, detailsResult] = await Promise.all([
    supabase
      .from("user_organizations")
      .select("organization_id, role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("organizations")
      .select("id, name, created_at")
      .eq("id", orgId)
      .single(),
  ]);

  const accessData: OrgAccessData | null = accessResult.data
    ? {
        organizationId: accessResult.data.organization_id,
        role: accessResult.data.role,
        hasAccess: true,
      }
    : null;

  const orgDetails: Organization | null = detailsResult.data
    ? (detailsResult.data as Organization)
    : null;

  // Cache access data
  if (accessData) {
    queryClient.setQueryData(
      ["organization", "access", orgId, user.id],
      accessData,
    );
  }

  // Cache organization details
  if (orgDetails) {
    queryClient.setQueryData(["organization", "details", orgId], orgDetails);
  }

  return {
    access: accessData,
    details: orgDetails,
  };
}

/**
 * Get cached organization access data
 */
export async function getOrgAccess(
  orgId: string,
  userId: string,
): Promise<ActionResult<OrgAccessData>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_organizations")
    .select("organization_id, role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return { success: false, error: "Access denied to this organization" };
  }

  return {
    success: true,
    data: {
      organizationId: data.organization_id,
      role: data.role,
      hasAccess: true,
    },
  };
}

/**
 * Get cached organization details
 */
export async function getOrgDetails(
  orgId: string,
): Promise<ActionResult<Organization>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, created_at")
    .eq("id", orgId)
    .single();

  if (error || !data) {
    return { success: false, error: "Organization not found" };
  }

  return {
    success: true,
    data: data as Organization,
  };
}
