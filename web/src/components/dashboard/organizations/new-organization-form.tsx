"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrg } from "@/lib/services/orgService";
import { useQueryClient } from "@tanstack/react-query";

export function NewOrganizationForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      const result = await createOrg(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      // Invalidate organizations query to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ["organizations"] });

      // Redirect to organizations page after creation
      router.push("/dashboard/organizations");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create organization",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col bg-elevated">
      <form
        onSubmit={handleSubmit}
        className="space-y-6 px-5 py-5 border rounded-md"
      >
        <div className="flex flex-col gap-1">
          <span className="text-foreground">Create a new Organization</span>
          <span className="text-muted-foreground text-xs">
            Organizations are a way to group repositories together. Each
            organization can be accessed by different team members.
          </span>
        </div>
        <Separator />

        <Field>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <input
            id="name"
            name="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Organization name"
            required
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
          <FieldDescription>
            Choose a unique name for your organization
          </FieldDescription>
          <FieldError>{error}</FieldError>
        </Field>

        <Separator />

        <div className="flex gap-3">
          <Button type="submit" size="sm" disabled={isLoading || !name.trim()}>
            {isLoading ? "Creating..." : "Create Organization"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
