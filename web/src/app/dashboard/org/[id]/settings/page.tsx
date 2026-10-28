"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { useRouter, useParams } from "next/navigation";

export default function OrganizationSettings() {
  const [orgName, setOrgName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [counts, setCounts] = useState({ members: 0, repos: 0 });
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState("");
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;
  const supabase = createClient(); // reads cookies automatically

  const isNameValid = orgName.trim().length > 0;

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: org }, { data: membership }, members, repos] =
        await Promise.all([
          supabase
            .from("organizations")
            .select("name")
            .eq("id", orgId)
            .single(),
          supabase
            .from("user_organizations")
            .select("role")
            .eq("organization_id", orgId)
            .eq("user_id", user.id)
            .single(),
          supabase
            .from("user_organizations")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", orgId),
          supabase
            .from("repositories")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", orgId),
        ]);

      if (org) {
        setOrgName(org.name);
        setSavedName(org.name);
      }
      setIsOwner(membership?.role === "owner");
      setCounts({ members: members.count ?? 0, repos: repos.count ?? 0 });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const handleSave = async () => {
    setError("");

    if (!isNameValid) {
      setError("Organization name is required");
      return;
    }

    // RLS silently skips non-owner updates, so check that a row actually changed
    const { data, error } = await supabase
      .from("organizations")
      .update({ name: orgName.trim() })
      .eq("id", orgId)
      .select();

    if (error || !data?.length) {
      console.error("Failed to update organization:", error);
      setError("Failed to update organization. Only owners can do this.");
      return;
    }

    router.push(`/dashboard/org/${orgId}`);
  };

  const handleDeleteClick = () => {
    setDeleteConfirmationText("");
    setDeleteStep(1);
  };

  const handleDeleteConfirm = async () => {
    setError("");
    setIsDeleting(true);

    const { data, error } = await supabase
      .from("organizations")
      .delete()
      .eq("id", orgId)
      .select();

    if (error || !data?.length) {
      console.error("Failed to delete organization:", error);
      setError("Failed to delete organization. Only owners can do this.");
      setIsDeleting(false);
      setDeleteStep(0);
      return;
    }

    router.push("/dashboard/organizations");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-12">
      <h1 className="text-3xl font-bold">Organization Settings</h1>
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
          {error}
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Edit organization name"
              disabled={!isOwner}
            />
          </div>

          {isOwner ? (
            <Button
              onClick={handleSave}
              disabled={!isNameValid}
              className={!isNameValid ? "opacity-50 cursor-not-allowed" : ""}
            >
              Save
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Only owners can change organization settings.
            </p>
          )}
        </CardContent>
      </Card>
      {isOwner && (
        <div className="pt-2 max-w-2xl mx-auto">
          <Button
            variant="destructive"
            onClick={handleDeleteClick}
            className="mt-2"
          >
            Delete Organization
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteStep > 0}
        onOpenChange={(open) => !open && !isDeleting && setDeleteStep(0)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {savedName}</DialogTitle>
            {deleteStep === 2 && (
              <DialogDescription>
                This will permanently delete the organization, its{" "}
                {counts.repos} {counts.repos === 1 ? "repository" : "repositories"}
                , and all documentation and chat history. This cannot be
                undone.
              </DialogDescription>
            )}
          </DialogHeader>

          {deleteStep === 1 ? (
            <div className="space-y-6 pt-2">
              <div className="flex flex-col items-center gap-2 text-center">
                <Building2 className="h-8 w-8 text-muted-foreground" />
                <p className="text-xl font-semibold">{savedName}</p>
                <p className="text-sm text-muted-foreground">
                  {counts.members} {counts.members === 1 ? "member" : "members"}{" "}
                  · {counts.repos}{" "}
                  {counts.repos === 1 ? "repository" : "repositories"}
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setDeleteStep(2)}
              >
                I want to delete this organization
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label
                  htmlFor="deleteConfirmation"
                  className="text-sm font-medium"
                >
                  To confirm, type{" "}
                  <span className="font-mono font-semibold">{savedName}</span>{" "}
                  in the box below
                </Label>
                <Input
                  id="deleteConfirmation"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  disabled={isDeleting}
                  autoComplete="off"
                  autoFocus
                  className="h-10"
                />
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleDeleteConfirm}
                disabled={isDeleting || deleteConfirmationText !== savedName}
              >
                {isDeleting ? "Deleting..." : "Delete this organization"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
