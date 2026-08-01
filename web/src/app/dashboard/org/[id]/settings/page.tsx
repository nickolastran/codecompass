"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/client";
import { useRouter, useParams } from "next/navigation";

export default function OrganizationSettings() {
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const params = useParams();
  const orgId = params.id;
  const supabase = createClient(); // reads cookies automatically

  const isNameValid = orgName.trim().length > 0;

  const handleSave = async () => {
    setError("");

    if (!isNameValid) {
      setError("Organization name is required");
      return;
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("User not authenticated", userError);
        setError("You are not authenticated");
        return;
      }

      const { data, error } = await supabase
        .from("organizations")
        .update({ name: orgName })
        .eq("id", orgId)
        .select();

      if (error) throw error;
      console.log("Updated organization:", data);
      router.push(`/dashboard/org/${orgId}`);
    } catch (err) {
      console.error("Failed to update organization:", err);
    }
  };

  const handleDelete = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("User not authenticated", userError);
        setError("You are not authenticated");
        return;
      }

      // Optional: confirmation guard
      const confirmDelete = confirm(
        "Are you sure you want to delete this organization? This cannot be undone.",
      );
      if (!confirmDelete) return;

      const { error } = await supabase
        .from("organizations")
        .delete()
        .eq("id", orgId);

      if (error) throw error;

      console.log("Organization deleted");
      router.push("/dashboard/organizations"); // Redirect wherever you want
    } catch (err) {
      console.error("Failed to delete organization:", err);
      setError("Failed to delete organization. Please try again.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-12">
      <h1 className="text-3xl font-bold">Organization Settings</h1>
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
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={!isNameValid}
            className={!isNameValid ? "opacity-50 cursor-not-allowed" : ""}
          >
            Save
          </Button>
        </CardContent>
      </Card>
      <div className="pt-2 max-w-2x1 mx-auto">
        <Button variant="destructive" onClick={handleDelete} className="mt-2">
          Delete Organization
        </Button>
      </div>
    </div>
  );
}
