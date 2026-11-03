import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RepoSettings from "@/components/dashboard/repo-settings";
import { getRepoIdByGithubSlug } from "@/lib/services/repoService";

export const metadata: Metadata = { title: "Repository Settings" };

export default async function GithubRepoSettingsPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  const id = await getRepoIdByGithubSlug(owner, repo);
  if (!id) notFound();
  return <RepoSettings repoId={id} />;
}
