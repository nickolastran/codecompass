import { redirect } from "next/navigation";
import {
  RepoView,
  getRepo,
  repoMetadata,
} from "@/components/dashboard/repo-view";
import { githubSlug, repoHref } from "@/lib/repo-href";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  return repoMetadata((await params).id);
}

// GitHub repos live at /dashboard/<owner>/<repo>; old id links redirect there
export default async function RepoPage({ params }: Props) {
  const { id } = await params;
  const repo = await getRepo(id);
  if (repo.success && githubSlug(repo.data.repo_url)) {
    redirect(repoHref(repo.data));
  }
  return <RepoView id={id} />;
}
