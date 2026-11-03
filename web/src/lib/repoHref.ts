
// Owners that collide with static /dashboard routes keep the id URL
const RESERVED = new Set([
  "chat",
  "install-github-app",
  "install-gitlab-app",
  "new",
  "org",
  "organizations",
  "profile",
  "repo",
]);

export function githubSlug(
  repoUrl: string | null | undefined,
): [owner: string, name: string] | null {
  const m = repoUrl?.match(
    /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/?#]+?)(?:\.git)?\/?$/i,
  );
  if (!m || RESERVED.has(m[1].toLowerCase())) return null;
  return [m[1], m[2]];
}

export function repoHref(repo: { id: string; repo_url: string | null }) {
  const slug = githubSlug(repo.repo_url);
  return slug
    ? `/dashboard/${slug[0]}/${slug[1]}`
    : `/dashboard/repo/${repo.id}`;
}
