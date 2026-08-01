export type GitLabProject = {
  id: number;
  name: string;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
  visibility: string;
  default_branch: string;
  last_activity_at: string;
};
