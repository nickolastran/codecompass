// Deliberately blank: we can't know yet whether the repo has docs, and the
// viewer shows the right skeleton (docs vs. not indexed) as soon as it mounts.
export default function RepoLoading() {
  return <div className="h-full bg-background" />;
}
