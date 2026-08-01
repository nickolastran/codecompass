export type User = {
  id: string;
  created_at: string;
  email: string;
};

export type Organization = {
  id: string;
  created_at: string;
  name: string;
};

export type OrganizationWithRole = Organization & {
  role: string;
  joined_at: string;
};

export type Repo = {
  id: string;
  created_at: string;
  indexed_by: string;
  organization_id: string;
  provider: string;
  repo_url: string | null;
  last_indexed_at: string | null;
  metadata: JSON | null;
  index_status: "not indexed" | "indexed" | "indexing";
  object_url: string | null;
  name: string;
};

export type Documentation = {
  id: string;
  created_at: string;
  repo_id: string;
  title: string | null;
  description: string | null;
  metadata: JSON | null;
  updated_at: string | null;
  version: number | null;
};

export type DocPage = {
  id: string;
  created_at: string;
  documentation_id: string;
  title: string | null;
  slug: string | null;
  content: string | null;
  order_index: number | null;
  parent_page_id: string | null;
  referenced_files: JSON | null;
  referenced_symbols: JSON | null;
  metadata: JSON | null;
  updated_at: string | null;
  repo_version: number | null;
};

export type Conversation = {
  id: string;
  created_at: string;
  user_id: string;
  repo_id: string;
  title: string | null;
  updated_at: string | null;
  repo_version: number | null;
};

export type ConversationMessage = {
  id: string;
  created_at: string;
  conversation_id: string;
  content: string;
  role: "user" | "assistant";
};

export type OrganizationMember = {
  user_id: string;
  organization_id: string;
  role: "owner" | "teammate";
  joined_at: string;
  user_email: string;
};

export type GitHubInstallation = {
  id: string;
  installation_id: string;
  account_login: string;
  account_type: string | null;
  installed_by: string | null;
  repositories_access: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CodeSnippet = {
  id: string;
  conversation_id: string;
  message_id: string;
  file_path: string;
  code_content: string;
  language: string | null;
  created_at: string;
  updated_at: string | null;
};
