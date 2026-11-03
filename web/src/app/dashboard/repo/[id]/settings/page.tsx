import { redirect } from "next/navigation";
import RepoSettings from "@/components/dashboard/repo-settings";
import { getRepo } from "@/components/dashboard/repo-view";
import { githubSlug, repoHref } from "@/lib/repo-href";

export default async function RepoSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await getRepo(id);
  if (repo.success && githubSlug(repo.data.repo_url)) {
    redirect(`${repoHref(repo.data)}/settings`);
  }
  return <RepoSettings repoId={id} />;
}
