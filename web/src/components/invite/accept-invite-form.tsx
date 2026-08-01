"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/lib/services/orgService";

type AcceptInviteFormProps = {
  token: string;
  organizationId: string;
  organizationName: string;
  isAuthenticated: boolean;
};

export function AcceptInviteForm({
  token,
  organizationId,
  organizationName,
  isAuthenticated,
}: AcceptInviteFormProps) {
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setIsAccepting(true);
    setError(null);

    try {
      const result = await acceptInvite(token);

      if (!result.success) {
        setError(result.error);
        setIsAccepting(false);
        return;
      }

      // Redirect to organization page
      router.push(`/dashboard/org/${result.data.organizationId}`);
    } catch (err) {
      console.error("Failed to accept invite:", err);
      setError("An unexpected error occurred");
      setIsAccepting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            You&pos;ve been invited to join {organizationName}
          </h1>
          <p className="text-muted-foreground">
            Please log in or create an account to accept this invitation.
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => router.push(`/login?redirect=/invite/${token}`)}
        >
          Log In / Sign Up
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto text-center space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          You&apos;ve been invited to join {organizationName}
        </h1>
        <p className="text-muted-foreground">
          Click below to accept the invitation and join the team.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
          {error}
        </div>
      )}

      <Button onClick={handleAccept} disabled={isAccepting} size="lg">
        {isAccepting ? "Joining..." : "Accept Invitation"}
      </Button>
    </div>
  );
}
