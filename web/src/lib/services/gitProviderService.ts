"use server";

import { githubApp } from "@/utils/github/app";
import { createClient } from "@/utils/supabase/server";
import { ActionResult } from "@/app/types/action";
import { Repo } from "@/app/types/supabase";
import type { GitLabProject } from "@/app/types/gitlab";

export async function verifyGithubRepoAccess(
  installation_id: string,
  owner: string,
  repo: string,
): Promise<boolean> {
  try {
    //convert installation_id to number
    const installationId = parseInt(installation_id, 10);
    const octokit = await githubApp.getInstallationOctokit(installationId);

    await octokit.request("GET /repos/{owner}/{repo}", {
      owner,
      repo,
    });

    return true;
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 404) {
      return false;
    }
    throw error;
  }
}

export async function verifyGitLabRepoAccess(
  access_token: string,
  owner: string,
  name: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://gitlab.com/api/v4/projects/${owner}/${name}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      },
    );

    return response.ok;
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 404) {
      return false;
    }
    throw error;
  }
}

export async function fetchGitLabProjects(
  access_token: string,
): Promise<GitLabProject[]> {
  try {
    // Fetch user's projects with membership (owned and member)
    const response = await fetch(
      "https://gitlab.com/api/v4/projects?membership=true&per_page=100&simple=true&order_by=last_activity_at&sort=desc",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.statusText}`);
    }

    const projects = await response.json();
    return projects as GitLabProject[];
  } catch (error) {
    console.error("Failed to fetch GitLab projects:", error);
    throw error;
  }
}

export async function importGitLabProjects(
  projects: GitLabProject[],
  orgId: string,
): Promise<ActionResult<Repo[]>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "User not found" };
  }

  const { data: installation, error: installationError } = await supabase
    .from("gitlab_installations")
    .select("*")
    .eq("installed_by", user.id)
    .single();

  if (installationError || !installation) {
    console.error("Failed to fetch GitLab installation:", installationError);
    return { success: false, error: "GitLab installation not found" };
  }

  const importedRepos: Repo[] = [];
  const errors: string[] = [];

  for (const project of projects) {
    try {
      // Verify access to the project by fetching it from GitLab API
      const verifyResponse = await fetch(
        `https://gitlab.com/api/v4/projects/${project.id}`,
        {
          headers: {
            Authorization: `Bearer ${installation.access_token}`,
          },
        },
      );

      if (!verifyResponse.ok) {
        errors.push(
          `Failed to verify access to ${project.path_with_namespace}`,
        );
        continue;
      }

      // Check if repository already exists
      const { data: existingRepo } = await supabase
        .from("repositories")
        .select("*")
        .eq("organization_id", orgId)
        .eq("repo_url", project.web_url)
        .single();

      if (existingRepo) {
        console.log(
          `Repository ${project.path_with_namespace} already exists, skipping`,
        );
        continue;
      }

      // Insert repository into database
      const { data: repo, error: insertError } = await supabase
        .from("repositories")
        .insert({
          name: project.name,
          provider: "gitlab",
          repo_url: project.web_url,
          organization_id: orgId,
          indexed_by: user.id,
          index_status: "not indexed",
        })
        .select()
        .single();

      if (insertError) {
        console.error(
          `Failed to insert ${project.path_with_namespace}:`,
          insertError,
        );
        errors.push(`Failed to import ${project.path_with_namespace}`);
        continue;
      }

      importedRepos.push(repo as Repo);
    } catch (error) {
      console.error(`Error processing ${project.path_with_namespace}:`, error);
      errors.push(
        `Error processing ${project.path_with_namespace}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Return success even if no new repos were imported (they might all be duplicates)
  // Only include error information if there were actual failures
  if (errors.length > 0) {
    console.warn("Some repositories failed to import:", errors.join(", "));
  }

  return { success: true, data: importedRepos };
}
