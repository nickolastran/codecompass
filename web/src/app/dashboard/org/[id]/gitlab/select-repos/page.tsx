import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { fetchGitLabProjects } from "@/lib/services/gitProviderService";
import { GitLabRepoSelector } from "@/components/dashboard/gitlab/repo-selector";

type SelectReposPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SelectReposPage({
  params,
}: SelectReposPageProps) {
  const { id: orgId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch GitLab installation for the user
  const { data: installation, error } = await supabase
    .from("gitlab_installations")
    .select("*")
    .eq("installed_by", user.id)
    .single();

  if (error || !installation) {
    // No GitLab installation found, redirect to install page
    redirect(`/dashboard/install-gitlab-app?org_id=${orgId}`);
  }

  // Fetch projects from GitLab API
  let projects;
  try {
    projects = await fetchGitLabProjects(installation.access_token);
  } catch (error) {
    console.error("Failed to fetch GitLab projects:", error);
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-destructive">
            Error Fetching Projects
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Failed to fetch your GitLab projects. Please try reconnecting your
            GitLab account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Select GitLab Repositories</h1>
          <p className="text-muted-foreground mt-2">
            Choose repositories to import into your organization
          </p>
        </div>

        <GitLabRepoSelector projects={projects} orgId={orgId} />
      </div>
    </div>
  );
}
