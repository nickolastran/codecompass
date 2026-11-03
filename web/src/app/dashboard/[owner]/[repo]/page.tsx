import { cache } from "react";
import { notFound } from "next/navigation";
import { RepoView, repoMetadata } from "@/components/dashboard/repoView";
import { getRepoIdByGithubSlug } from "@/lib/services/repoService";

type Props = { params: Promise<{ owner: string; repo: string }> };

const resolveId = cache(getRepoIdByGithubSlug);

export async function generateMetadata({ params }: Props) {
  const { owner, repo } = await params;
  const id = await resolveId(owner, repo);
  return id ? repoMetadata(id) : { title: "Repository" };
}

export default async function GithubRepoPage({ params }: Props) {
  const { owner, repo } = await params;
  const id = await resolveId(owner, repo);
  if (!id) notFound();
  return <RepoView id={id} />;
}
