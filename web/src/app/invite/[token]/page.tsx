import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { AcceptInviteForm } from "@/components/invite/accept-invite-form";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Validate token and fetch invite with organization details
  const { data: invite, error: inviteError } = await supabase
    .from("organization_invites")
    .select("*, organizations(name)")
    .eq("token", token)
    .single();

  // Handle invalid token
  if (inviteError || !invite) {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-md mx-auto text-center space-y-4">
          <h1 className="text-2xl font-semibold">Invalid Invite Link</h1>
          <p className="text-muted-foreground">
            This invite link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  // 2. Check if already used
  if (invite.used_at) {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-md mx-auto text-center space-y-4">
          <h1 className="text-2xl font-semibold">Invite Already Used</h1>
          <p className="text-muted-foreground">
            This invite link has already been used and cannot be used again.
          </p>
        </div>
      </div>
    );
  }

  // 3. Check if expired
  const now = new Date();
  const expiresAt = new Date(invite.expires_at);
  if (now > expiresAt) {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-md mx-auto text-center space-y-4">
          <h1 className="text-2xl font-semibold">Invite Expired</h1>
          <p className="text-muted-foreground">
            This invite link has expired. Please request a new one from the
            organization owner.
          </p>
        </div>
      </div>
    );
  }

  // 4. Check if user is already a member
  if (user) {
    const { data: existingMembership } = await supabase
      .from("user_organizations")
      .select("organization_id")
      .eq("organization_id", invite.organization_id)
      .eq("user_id", user.id)
      .single();

    if (existingMembership) {
      // Already a member, redirect to organization
      redirect(`/dashboard/org/${invite.organization_id}`);
    }
  }

  // 5. Extract organization name
  const orgName = Array.isArray(invite.organizations)
    ? invite.organizations[0]?.name
    : invite.organizations?.name;

  // 6. Show accept invite form
  return (
    <div className="container mx-auto py-16 px-4">
      <AcceptInviteForm
        token={token}
        organizationId={invite.organization_id}
        organizationName={orgName || "Organization"}
        isAuthenticated={!!user}
      />
    </div>
  );
}
