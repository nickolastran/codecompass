import { redirect } from "next/navigation";
import RepoSettings from "@/components/dashboard/repoSettings";
import { getRepo } from "@/components/dashboard/repoView";
import { githubSlug, repoHref } from "@/lib/repoHref";

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
