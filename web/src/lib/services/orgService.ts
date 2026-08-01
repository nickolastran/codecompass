"use server";

import { createClient, createAdminClient } from "@/utils/supabase/server";
import {
  Organization,
  OrganizationWithRole,
  OrganizationMember,
} from "@/app/types/supabase";
import { ActionResult } from "@/app/types/action";

export async function getOrgs(): Promise<ActionResult<OrganizationWithRole[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "User not found" };
  }

  // Query from user_organizations table to properly filter by user_id
  const { data: userOrgs, error: organizationsError } = await supabase
    .from("user_organizations")
    .select("role,joined_at,organizations(id,name,created_at)")
    .eq("user_id", user.id);

  if (organizationsError) {
    return { success: false, error: organizationsError.message };
  }

  // Transform the data to match OrganizationWithRole structure
  const organizations: OrganizationWithRole[] = (userOrgs ?? []).map((uo) => {
    const org = uo.organizations as Organization | Organization[];
    // Handle case where organizations might be an array (shouldn't happen with proper FK)
    const orgData = Array.isArray(org) ? org[0] : org;

    return {
      id: orgData.id,
      name: orgData.name,
      created_at: orgData.created_at,
      role: uo.role,
      joined_at: uo.joined_at,
    };
  });

  return {
    success: true,
    data: organizations,
  };
}

export async function getOrgById(
  orgId: string,
): Promise<ActionResult<Organization>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "User not found" };
  }

  const { data: organization, error } = await supabase
    .from("organizations")
    .select("id,name,created_at")
    .eq("id", orgId)
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  if (!organization) {
    return { success: false, error: "Organization not found" };
  }

  return { success: true, data: organization };
}

export async function getOrgMembers(
  orgId: string,
): Promise<ActionResult<OrganizationMember[]>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated" };
  }

  // Verify user has access to this organization
  const { data: userOrg, error: accessError } = await supabase
    .from("user_organizations")
    .select("organization_id")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single();

  if (accessError || !userOrg) {
    return { success: false, error: "Access denied to this organization" };
  }

  // Fetch all members of the organization with their user details
  // Join with users table to get email addresses
  const { data: members, error: membersError } = await supabase
    .from("user_organizations")
    .select("user_id, organization_id, role, joined_at, users(email)")
    .eq("organization_id", orgId)
    .order("joined_at", { ascending: true });

  if (membersError) {
    return { success: false, error: membersError.message };
  }

  if (!members || members.length === 0) {
    return { success: true, data: [] };
  }

  // Transform the joined data to match OrganizationMember type
  const membersWithEmails: OrganizationMember[] = members.map((m) => {
    // Handle the users field which could be an object or array due to the join
    const userData = m.users as { email: string } | { email: string }[] | null;
    const email = Array.isArray(userData)
      ? userData[0]?.email || "Unknown"
      : userData?.email || "Unknown";

    return {
      user_id: m.user_id,
      organization_id: m.organization_id,
      role: m.role as "owner" | "teammate",
      joined_at: m.joined_at,
      user_email: email,
    };
  });

  return { success: true, data: membersWithEmails };
}

export async function createOrg(
  formData: FormData,
): Promise<ActionResult<Organization>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "User not found" };
  }

  const name = formData.get("name") as string;

  if (!name || name.trim() === "") {
    return { success: false, error: "Organization name is required" };
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .insert({
      name: name.trim(),
    })
    .select()
    .single();

  if (organizationError) {
    return { success: false, error: organizationError.message };
  }

  const { error: userOrganizationError } = await supabase
    .from("user_organizations")
    .insert({
      user_id: user.id,
      organization_id: organization.id,
      role: "owner",
    })
    .select()
    .single();

  if (userOrganizationError) {
    return { success: false, error: userOrganizationError.message };
  }

  return { success: true, data: organization };
}

export async function createInviteLink(
  organizationId: string,
): Promise<ActionResult<{ token: string; expiresAt: string }>> {
  const supabase = await createClient();

  //authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  //check membership
  const { data: userOrg, error: accessError } = await supabase
    .from("user_organizations")
    .select("organization_id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .single();

  if (accessError || !userOrg) {
    return {
      success: false,
      error: "User does not have access to this organization!",
    };
  }

  //generate a secure token

  const token = crypto.randomUUID();

  //calculate expiry date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  //store the invite in supa

  const { error: inviteError } = await supabase
    .from("organization_invites")
    .insert({
      organization_id: organizationId,
      created_by: user.id,
      token,
      expires_at: expiresAt.toISOString(),
    });

  if (inviteError) {
    console.error("Failed to create invite:", inviteError);
    return { success: false, error: "Failed to create invite link" };
  }

  return {
    success: true,
    data: {
      token,
      expiresAt: expiresAt.toISOString(),
    },
  };
}

export async function acceptInvite(
  token: string,
): Promise<ActionResult<{ organizationId: string }>> {
  const supabase = await createClient();

  // 1. Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: "You must be logged in to accept an invite",
    };
  }

  // 2. Fetch and validate invite (with locking to prevent race conditions)
  const { data: invite, error: inviteError } = await supabase
    .from("organization_invites")
    .select("*")
    .eq("token", token)
    .is("used_at", null) // Only get unused invites
    .single();

  if (inviteError || !invite) {
    return { success: false, error: "Invalid or expired invite link" };
  }

  // 3. Check expiration
  const now = new Date();
  const expiresAt = new Date(invite.expires_at);
  if (now > expiresAt) {
    return { success: false, error: "This invite has expired" };
  }

  // 4. Check if user is already a member
  const { data: existingMembership } = await supabase
    .from("user_organizations")
    .select("organization_id")
    .eq("organization_id", invite.organization_id)
    .eq("user_id", user.id)
    .single();

  if (existingMembership) {
    return {
      success: false,
      error: "You are already a member of this organization",
    };
  }

  // 5. Add user to organization
  const { error: membershipError } = await supabase
    .from("user_organizations")
    .insert({
      user_id: user.id,
      organization_id: invite.organization_id,
      role: "teammate", // Default role for invited users
    });

  if (membershipError) {
    console.error("Failed to add user to organization:", membershipError);
    return { success: false, error: "Failed to join organization" };
  }

  // 6. Mark invite as used (using admin client with secret key to bypass RLS)
  const adminClient = createAdminClient();
  const { error: updateError } = await adminClient
    .from("organization_invites")
    .update({
      used_at: new Date().toISOString(),
      used_by: user.id,
    })
    .eq("token", token);

  if (updateError) {
    console.error("Failed to mark invite as used:", updateError);
    // Don't return error - user was already added successfully
  }

  return {
    success: true,
    data: { organizationId: invite.organization_id },
  };
}

export async function removeMemberFromOrg(
  organizationId: string,
  userIdToRemove: string,
): Promise<ActionResult<void>> {
  const supabase = await createClient();

  // 1. Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated" };
  }

  // 2. Verify current user is an owner (RLS will also enforce this)
  const { data: currentUserRole, error: roleError } = await supabase
    .from("user_organizations")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .single();

  if (roleError || !currentUserRole || currentUserRole.role !== "owner") {
    return {
      success: false,
      error: "Only organization owners can remove members",
    };
  }

  // 3. Check if the user being removed is the last owner
  if (userIdToRemove === user.id) {
    const { data: owners, error: ownersError } = await supabase
      .from("user_organizations")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("role", "owner");

    if (ownersError) {
      return { success: false, error: "Failed to verify ownership status" };
    }

    if (owners && owners.length <= 1) {
      return {
        success: false,
        error: "Cannot remove the last owner from the organization",
      };
    }
  }

  // 4. Remove the member (RLS policy will enforce owner permission)
  const { error: deleteError } = await supabase
    .from("user_organizations")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userIdToRemove);

  if (deleteError) {
    return { success: false, error: "Failed to remove member" };
  }

  return { success: true, data: undefined };
}

export async function leaveOrganization(
  organizationId: string,
): Promise<ActionResult<void>> {
  const supabase = await createClient();

  // 1. Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated" };
  }

  // 2. Verify user is a member of this organization
  const { data: membership, error: membershipError } = await supabase
    .from("user_organizations")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .single();

  if (membershipError || !membership) {
    return {
      success: false,
      error: "You are not a member of this organization",
    };
  }

  // 3. If user is an owner, check if they're the last owner
  if (membership.role === "owner") {
    const { data: owners, error: ownersError } = await supabase
      .from("user_organizations")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("role", "owner");

    if (ownersError) {
      return { success: false, error: "Failed to verify ownership status" };
    }

    if (owners && owners.length <= 1) {
      return {
        success: false,
        error: "Cannot leave as the last owner. Transfer ownership first.",
      };
    }
  }

  // 4. Remove the user from the organization
  const { error: deleteError } = await supabase
    .from("user_organizations")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", user.id);

  if (deleteError) {
    return { success: false, error: "Failed to leave organization" };
  }

  return { success: true, data: undefined };
}

export async function updateMemberRole(
  organizationId: string,
  userIdToUpdate: string,
  newRole: "owner" | "teammate",
): Promise<ActionResult<void>> {
  const supabase = await createClient();

  // 1. Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated" };
  }

  // 2. Verify current user is an owner
  const { data: currentUserRole, error: roleError } = await supabase
    .from("user_organizations")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .single();

  if (roleError || !currentUserRole || currentUserRole.role !== "owner") {
    return {
      success: false,
      error: "Only organization owners can change member roles",
    };
  }

  // 3. Get current role of user being updated
  const { data: targetUser, error: targetError } = await supabase
    .from("user_organizations")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userIdToUpdate)
    .single();

  if (targetError || !targetUser) {
    return { success: false, error: "Member not found" };
  }

  // 4. If demoting from owner to teammate, check if they're the last owner
  if (targetUser.role === "owner" && newRole === "teammate") {
    const { data: owners, error: ownersError } = await supabase
      .from("user_organizations")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("role", "owner");

    if (ownersError) {
      return { success: false, error: "Failed to verify ownership status" };
    }

    if (owners && owners.length <= 1) {
      return {
        success: false,
        error: "Cannot demote the last owner. Promote another member first.",
      };
    }
  }

  // 5. Update the role
  const { error: updateError } = await supabase
    .from("user_organizations")
    .update({ role: newRole })
    .eq("organization_id", organizationId)
    .eq("user_id", userIdToUpdate);

  if (updateError) {
    return { success: false, error: "Failed to update member role" };
  }

  return { success: true, data: undefined };
}
