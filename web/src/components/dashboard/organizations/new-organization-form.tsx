"use client";

import { Button } from "@/components/ui/button";
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
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-card"
    >
      {/* Header */}
      <div className="px-6 py-5">
        <h1 className="text-base font-semibold text-foreground">
          Create a new organization
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Organizations are a way to group repositories together. Each
          organization can be accessed by different team members.
        </p>
      </div>

      {/* Name */}
      <div className="grid grid-cols-1 gap-3 border-t border-border px-6 py-6 sm:grid-cols-4 sm:gap-6">
        <label
          htmlFor="name"
          className="text-sm font-medium text-foreground sm:pt-2"
        >
          Name
        </label>
        <div className="sm:col-span-3">
          <input
            id="name"
            name="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Organization name"
            required
            aria-invalid={!!error}
            aria-describedby="name-description"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p
            id="name-description"
            className="mt-2 text-sm leading-relaxed text-muted-foreground"
          >
            What&apos;s the name of your company or team? You can change this
            later.
          </p>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-border px-6 py-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isLoading || !name.trim()}>
          {isLoading ? "Creating..." : "Create organization"}
        </Button>
      </div>
    </form>
  );
}
