"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldSet,
} from "@/components/ui/field";

import { Input } from "@/components/ui/input";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";
import {
  createRepoViaGithub,
  createRepoViaOAuthProvider,
  createRepoViaMercurial,
  createRepoViaLocalFile,
} from "@/lib/services/repoService";
import { useQueryClient } from "@tanstack/react-query";

const PROVIDER_LABELS: Record<string, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  mercurial: "Mercurial",
};

type NewProjectFormProps = {
  orgId: string;
};

export function NewProjectForm({ orgId }: NewProjectFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [type, setType] = useState("local");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);

      if (type === "local") {
        // Validate that a file has been uploaded
        if (!uploadedFile) {
          setError("Please select a .zip file to upload");
          setIsLoading(false);
          return;
        }

        const result = await createRepoViaLocalFile(formData, orgId);

        if (!result.success) {
          setError(result.error);
          setIsLoading(false);
          return;
        }

        // Invalidate repositories query to refetch fresh data
        queryClient.invalidateQueries({ queryKey: ["repositories", orgId] });
        toast.success("Repository added");

        router.push(`/dashboard/org/${orgId}`);
      } else {
        const result =
          type === "github"
            ? await createRepoViaGithub(formData, orgId)
            : type === "mercurial"
              ? await createRepoViaMercurial(formData, orgId)
              : await createRepoViaOAuthProvider(formData, orgId);

        if (!result.success) {
          if (result.error === "Name is required!") {
            setNameError(result.error);
            setIsLoading(false);
            return;
          }
          if (result.error === "Installation Needed") {
            // Connect the provider first, then come back here
            router.push(
              type === "github"
                ? `/dashboard/install-github-app?org_id=${orgId}`
                : `/dashboard/connect/${type}?org_id=${orgId}`,
            );
            return;
          }
          setError(result.error);
          setIsLoading(false);
          return;
        }

        // Invalidate repositories query to refetch fresh data
        queryClient.invalidateQueries({ queryKey: ["repositories", orgId] });
        toast.success("Repository added");

        router.push(`/dashboard/org/${orgId}`);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col bg-elevated">
      <form
        onSubmit={handleSubmit}
        autoComplete="off"
        className="space-y-6 px-5 py-5 border rounded-md"
      >
        {/* Hidden input to ensure type value is submitted */}
        <input type="hidden" name="type" value={type} />

        <div className="flex flex-col gap-1">
          <span className="text-foreground">Index a new Repository</span>
          <span className="text-muted-foreground text-xs">
            Index a repository to generate documentation and start chatting with
            the codebase.
          </span>
        </div>
        <Separator />

        <FieldSet>
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <input
              id="name"
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Repository name"
              required
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
            <FieldDescription>
              Choose a name for the repository.
            </FieldDescription>
            <FieldError>{nameError}</FieldError>
          </Field>
          <Separator />
          <Field>
            <FieldLabel htmlFor="type">Type</FieldLabel>
            <Select
              value={type}
              onValueChange={(value) => {
                setType(value);
              }}
            >
              <SelectTrigger id="type" name="type">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Select a Type</SelectLabel>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="gitlab">GitLab</SelectItem>
                  <SelectItem value="bitbucket">Bitbucket</SelectItem>
                  <SelectItem value="mercurial">Mercurial</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>Select a repository type</FieldDescription>
            {type !== "local" && (
              <div className="flex flex-col gap-3 py-2">
                <Separator />
                <Field className="py-2">
                  <FieldLabel htmlFor="repo-url">
                    {PROVIDER_LABELS[type]} URL
                  </FieldLabel>
                  <Input
                    id="repo-url"
                    name="repo-url"
                    type="url"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                  <FieldDescription>
                    {type === "mercurial"
                      ? "Enter the https:// URL of a public Mercurial repository."
                      : `Enter the URL of the ${PROVIDER_LABELS[type]} repository.`}
                  </FieldDescription>
                  <FieldError>{error}</FieldError>
                </Field>
              </div>
            )}
            {type === "local" && (
              <div className="flex flex-col gap-3 py-2">
                <Separator />
                <Field className="py-2">
                  <FieldLabel htmlFor="file">File (.zip)</FieldLabel>
                  <Input
                    id="file"
                    name="file"
                    type="file"
                    accept=".zip,application/zip"
                    onChange={(e) =>
                      setUploadedFile(e.target.files?.[0] || null)
                    }
                    className="cursor-pointer file:cursor-pointer file:border file:border-gray-700 file:bg-elevated file:hover:border-gray-600 file:px-4 file:py-1 file:rounded-md file:mr-3 file:transition-colors"
                  />
                  <FieldDescription>
                    {uploadedFile
                      ? `Selected: ${uploadedFile.name} (${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)`
                      : "Upload a .zip file of the local repository."}
                  </FieldDescription>
                  <FieldError>{error}</FieldError>
                </Field>
              </div>
            )}
          </Field>
        </FieldSet>

        <Separator />

        <div className="flex gap-3">
          <Button type="submit" size="sm" disabled={isLoading || !name.trim()}>
            {isLoading ? "Creating..." : "Create Repository"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/org/${orgId}`)}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
