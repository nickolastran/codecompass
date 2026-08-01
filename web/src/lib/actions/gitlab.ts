"use server";

import { importGitLabProjects as importProjects } from "@/lib/services/gitProviderService";
import { ActionResult } from "@/app/types/action";
import { Repo } from "@/app/types/supabase";
import { GitLabProject } from "@/app/types/gitlab";

export async function importGitLabRepositories(
  projects: GitLabProject[],
  orgId: string,
): Promise<ActionResult<Repo[]>> {
  return importProjects(projects, orgId);
}
