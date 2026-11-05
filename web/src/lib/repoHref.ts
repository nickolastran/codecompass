
// Owners that collide with static /dashboard routes keep the id URL
const RESERVED = new Set([
  "chat",
  "install-github-app",
  "connect",
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

// "group/sub/repo" (GitLab) or "workspace/repo" (Bitbucket) from a web, clone or SSH URL
export function providerRepoPath(
  provider: "gitlab" | "bitbucket",
  url: string,
): string | null {
  const host = provider === "gitlab" ? "gitlab\\.com" : "bitbucket\\.org";
  const m = url
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/, "")
    .match(new RegExp(`${host}[/:](.+)`, "i"));
  if (!m) return null;

  // Drop /-/tree/... (GitLab) and /src/... (Bitbucket, always workspace/repo)
  const parts = m[1].split("/-/")[0].split("/");
  const path = (provider === "bitbucket" ? parts.slice(0, 2) : parts).join("/");
  return parts.length >= 2 ? path : null;
}
