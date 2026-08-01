"use server";

import { createClient } from "@/utils/supabase/server";
import {
  Repo,
  Documentation,
  DocPage,
  Conversation,
  ConversationMessage,
  CodeSnippet,
} from "@/app/types/supabase";
import { ActionResult } from "@/app/types/action";
import {
  verifyGithubRepoAccess,
  verifyGitLabRepoAccess,
} from "./gitProviderService";

// Helper function to parse GitHub URLs
function parseGitHubUrl(url: string): { owner: string; repo: string } {
  try {
    // Handle multiple formats:
    // - https://github.com/owner/repo
    // - https://github.com/owner/repo.git
    // - git@github.com:owner/repo.git

    url = url.trim().replace(/\.git$/, "");

    if (url.includes("github.com/")) {
      const parts = url.split("github.com/")[1].split("/");
      return { owner: parts[0], repo: parts[1] };
    }

    if (url.startsWith("git@github.com:")) {
      const parts = url.replace("git@github.com:", "").split("/");
      return { owner: parts[0], repo: parts[1] };
    }

    return { owner: "", repo: "" };
  } catch (error) {
    return { owner: "", repo: "" };
  }
}

// Helper function to parse GitLab URLs
function parseGitLabUrl(url: string): { owner: string; repo: string } {
  try {
    // Handle multiple formats:
    // - https://gitlab.com/owner/repo
    // - https://gitlab.com/owner/subgroup/repo
    // - https://gitlab.com/owner/repo.git
    // - git@gitlab.com:owner/repo.git
    // - Self-hosted: https://gitlab.example.com/owner/repo

    url = url.trim().replace(/\.git$/, "");

    // Handle HTTPS URLs (gitlab.com or self-hosted)
    if (url.includes("gitlab.com/") || /gitlab\.[^/]+\//.test(url)) {
      // Extract the path after the domain
      const match = url.match(/gitlab[^/]*\/(.+)/);
      if (match) {
        const pathParts = match[1].split("/");
        // GitLab supports nested groups, so we need to handle:
        // - owner/repo (2 parts)
        // - owner/subgroup/repo (3+ parts)
        if (pathParts.length >= 2) {
          // Take everything except the last part as owner/group
          const repo = pathParts[pathParts.length - 1];
          const owner = pathParts.slice(0, -1).join("/");
          return { owner, repo };
        }
      }
    }

    // Handle SSH URLs
    if (url.startsWith("git@gitlab.com:") || /git@gitlab\.[^:]+:/.test(url)) {
      const match = url.match(/git@gitlab[^:]*:(.+)/);
      if (match) {
        const pathParts = match[1].split("/");
        if (pathParts.length >= 2) {
          const repo = pathParts[pathParts.length - 1];
          const owner = pathParts.slice(0, -1).join("/");
          return { owner, repo };
        }
      }
    }

    return { owner: "", repo: "" };
  } catch (error) {
    return { owner: "", repo: "" };
  }
}

export async function getReposByOrganizationId(
  organizationId: string,
): Promise<ActionResult<Repo[]>> {
  const client = await createClient();

  const user = client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  const { data, error } = await client
    .from("repositories")
    .select("*")
    .eq("organization_id", organizationId);

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  return { success: true, data: (data ?? []) as Repo[] };
}

export async function createRepoViaGithub(
  formData: FormData,
  orgId: string,
): Promise<ActionResult<Repo | undefined>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  const name = formData.get("name") as string;
  const provider = formData.get("type") as string;
  const url = formData.get("github-url") as string;

  if (!name) {
    return { success: false, error: "Name is required!" };
  }

  const { data: installation } = await client
    .from("github_installations")
    .select("*")
    .eq("installed_by", user.id)
    .single();

  if (!installation) {
    // No GitHub App installation - prompt user to install
    return {
      success: false,
      error: "Installation Needed",
    };
  }

  //parse url for owner and repo
  const { owner, repo: repoName } = parseGitHubUrl(url);

  const hasAccess = await verifyGithubRepoAccess(
    installation.installation_id,
    owner,
    repoName,
  );

  if (!hasAccess) {
    return {
      success: false,
      error: "Access Denied",
    };
  }

  const { data: repo, error: repoError } = await client
    .from("repositories")
    .insert({
      name,
      provider,
      repo_url: url,
      organization_id: orgId,
      indexed_by: user.id,
      index_status: "not indexed",
    })
    .select()
    .single();

  if (repoError) {
    return { success: false, error: repoError.message };
  }

  return { success: true, data: repo as Repo };
}

export async function createRepoViaGitlab(
  formData: FormData,
  orgId: string,
): Promise<ActionResult<Repo | undefined>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  const name = formData.get("name") as string;
  const provider = formData.get("type") as string;
  const url = formData.get("gitlab-url") as string;

  // Validate inputs
  if (!name || name.trim() === "") {
    return { success: false, error: "Repository name is required" };
  }

  if (!url || url.trim() === "") {
    return { success: false, error: "GitLab URL is required" };
  }

  const { data: installation } = await client
    .from("gitlab_installations")
    .select("*")
    .eq("installed_by", user.id)
    .single();

  if (!installation) {
    return { success: false, error: "Installation Needed" };
  }

  const { owner, repo: repoName } = parseGitLabUrl(url);

  //verify access
  const hasAccess = await verifyGitLabRepoAccess(
    installation.access_token,
    owner,
    repoName,
  );

  if (!hasAccess) {
    if (installation.access_token) {
      return {
        success: false,
        error: "Access required!",
      };
    }

    return {
      success: false,
      error: "Access denied!",
    };
  }

  const { data: repo, error: repoError } = await client
    .from("repositories")
    .insert({
      name,
      provider,
      repo_url: url,
      organization_id: orgId,
      indexed_by: user.id,
      index_status: "not indexed",
    })
    .select()
    .single();

  if (repoError) {
    return { success: false, error: repoError.message };
  }

  return { success: true, data: repo };
}

export async function createRepoViaLocalFile(
  formData: FormData,
  orgId: string,
): Promise<ActionResult<Repo>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  const name = formData.get("name") as string;
  const file = formData.get("file") as File;

  // Validate inputs
  if (!name || name.trim() === "") {
    return { success: false, error: "Repository name is required" };
  }

  if (!file) {
    return { success: false, error: "File is required" };
  }

  // Validate file type
  if (!file.name.endsWith(".zip")) {
    return { success: false, error: "Only .zip files are allowed" };
  }

  // Validate file size (max 100MB)
  const maxSize = 100 * 1024 * 1024; // 100MB in bytes
  if (file.size > maxSize) {
    return {
      success: false,
      error: "File size exceeds 100MB limit",
    };
  }

  try {
    // Generate a unique file name to prevent collisions
    const timestamp = Date.now();
    const sanitizedName = name.trim().replace(/[^a-z0-9-_]/gi, "_");
    const fileName = `${sanitizedName}_${timestamp}_${file.name}`;
    const filePath = `${orgId}/${fileName}`;

    // Upload file to Supabase Storage
    const { error: uploadError } = await client.storage
      .from("local_repos")
      .upload(filePath, file, {
        contentType: "application/zip",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return {
        success: false,
        error: `File upload failed: ${uploadError.message}`,
      };
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = client.storage
      .from("local_repos")
      .getPublicUrl(filePath);

    // Create repository record in database
    const { data: repo, error: repoError } = await client
      .from("repositories")
      .insert({
        name: name.trim(),
        provider: "local",
        repo_url: null,
        object_url: urlData.publicUrl,
        organization_id: orgId,
        indexed_by: user.id,
        index_status: "not indexed",
      })
      .select()
      .single();

    if (repoError) {
      console.error("Repository creation error:", repoError);
      // Attempt to clean up uploaded file
      await client.storage.from("local_repos").remove([filePath]);
      return {
        success: false,
        error: `Repository creation failed: ${repoError.message}`,
      };
    }

    return { success: true, data: repo as Repo };
  } catch (error) {
    console.error("Unexpected error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

// ============================================================================
// Repository Management Services
// ============================================================================

export async function getRepoWithStatus(
  repoId: string,
): Promise<ActionResult<Repo>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  const { data: repo, error } = await client
    .from("repositories")
    .select("*")
    .eq("id", repoId)
    .single();

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  if (!repo) {
    return { success: false, error: "Repository not found" };
  }

  return { success: true, data: repo as Repo };
}

type UpdateData = {
  name?: string;
  repo_url?: string;
  object_url?: string;
  index_status?: string;
};

export async function updateRepoSettings(
  repoId: string,
  settings: { name?: string; repo_url?: string; file?: File },
): Promise<ActionResult<Repo>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  // Get the current repo to check its provider type
  const { data: currentRepo } = await client
    .from("repositories")
    .select("*")
    .eq("id", repoId)
    .single();

  if (!currentRepo) {
    return { success: false, error: "Repository not found!" };
  }

  const updateData: UpdateData = {};

  // Handle name update
  if (settings.name) {
    updateData.name = settings.name;
  }

  // Handle GitHub URL update
  if (settings.repo_url && currentRepo.provider === "github") {
    const { owner, repo } = parseGitHubUrl(settings.repo_url);

    if (!owner || !repo) {
      return { success: false, error: "Invalid GitHub URL format!" };
    }

    // Verify access to the new repo
    const { data: installation } = await client
      .from("github_installations")
      .select("*")
      .eq("installed_by", user.id)
      .single();

    if (!installation) {
      return { success: false, error: "GitHub App not installed!" };
    }

    const hasAccess = await verifyGithubRepoAccess(
      installation.installation_id.toString(),
      owner,
      repo,
    );

    if (!hasAccess) {
      return {
        success: false,
        error:
          "Cannot access this repository. Make sure the GitHub App is installed for this repository.",
      };
    }

    updateData.repo_url = settings.repo_url;
    updateData.index_status = "not indexed"; // Trigger re-indexing
  }

  // Handle local file upload
  if (settings.file && currentRepo.provider === "local") {
    const file = settings.file;
    const fileExt = file.name.split(".").pop();

    if (fileExt !== "zip") {
      return { success: false, error: "Only .zip files are allowed!" };
    }

    // Upload to Supabase Storage
    const fileName = `${repoId}-${Date.now()}.zip`;
    const { data: uploadData, error: uploadError } = await client.storage
      .from("local_repos")
      .upload(fileName, file);

    if (uploadError) {
      console.error(uploadError);
      return { success: false, error: "Failed to upload file!" };
    }

    // Get public URL
    const { data: urlData } = client.storage
      .from("local_repos")
      .getPublicUrl(fileName);

    updateData.object_url = urlData.publicUrl;
    updateData.index_status = "pending"; // Trigger re-indexing
  }

  // Update the repository
  const { data: repo, error } = await client
    .from("repositories")
    .update(updateData)
    .eq("id", repoId)
    .select()
    .single();

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  return { success: true, data: repo as Repo };
}

export async function deleteRepo(
  repoId: string,
): Promise<ActionResult<{ organizationId: string }>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  // Fetch the organization_id before deleting
  const { data: repo, error: repoError } = await client
    .from("repositories")
    .select("organization_id")
    .eq("id", repoId)
    .single();

  if (repoError) {
    console.error(repoError);
    return { success: false, error: repoError.message };
  }

  if (!repo) {
    return { success: false, error: "Repository not found" };
  }

  const { error } = await client.from("repositories").delete().eq("id", repoId);

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  return { success: true, data: { organizationId: repo.organization_id } };
}

export async function triggerReindex(
  repoId: string,
): Promise<ActionResult<void>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  // Update the index_status to 'pending' to trigger reindexing
  const { error } = await client
    .from("repositories")
    .update({ index_status: "pending" })
    .eq("id", repoId);

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  // TODO: Trigger actual indexing job/webhook/queue here
  // This could be an API call to your indexing service

  return { success: true, data: undefined };
}

// ============================================================================
// Documentation Services
// ============================================================================

export async function getDocumentation(
  repoId: string,
): Promise<ActionResult<Documentation>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  const { data: documentation, error } = await client
    .from("documentation")
    .select("*")
    .eq("repo_id", repoId)
    .single();

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  if (!documentation) {
    return { success: false, error: "Documentation not found" };
  }

  return { success: true, data: documentation as Documentation };
}

export async function getDocPages(
  repoId: string,
): Promise<ActionResult<DocPage[]>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  // Get the latest documentation version for this repo
  const { data: documentation, error: docError } = await client
    .from("documentation")
    .select("id")
    .eq("repo_id", repoId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (docError || !documentation) {
    console.error(docError);
    return { success: false, error: "Documentation not found" };
  }

  const { data: pages, error } = await client
    .from("pages")
    .select("*")
    .eq("documentation_id", documentation.id)
    .order("order_index", { ascending: true });

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  return { success: true, data: (pages ?? []) as DocPage[] };
}

export async function getDocPageById(
  pageId: string,
): Promise<ActionResult<DocPage>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  const { data: page, error } = await client
    .from("doc_pages")
    .select("*")
    .eq("id", pageId)
    .single();

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  if (!page) {
    return { success: false, error: "Page not found" };
  }

  return { success: true, data: page as DocPage };
}

export async function getDocPagesHierarchical(
  repoId: string,
): Promise<ActionResult<DocPage[]>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  // First get the documentation ID for this repo
  const { data: documentation, error: docError } = await client
    .from("documentation")
    .select("id")
    .eq("repo_id", repoId)
    .single();

  if (docError || !documentation) {
    console.error(docError);
    return { success: false, error: "Documentation not found" };
  }

  const { data: pages, error } = await client
    .from("doc_pages")
    .select("*")
    .eq("documentation_id", documentation.id)
    .order("order_index", { ascending: true });

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  // Pages are already sorted by order_index
  // The parent_page_id field maintains the hierarchy
  // Frontend can use this to render the tree structure
  return { success: true, data: (pages ?? []) as DocPage[] };
}

/**
 * Get all documentation versions for a repository
 */
export async function getDocumentationVersions(
  repoId: string,
): Promise<ActionResult<Documentation[]>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  const { data: versions, error } = await client
    .from("documentation")
    .select("*")
    .eq("repo_id", repoId)
    .order("version", { ascending: false });

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  return { success: true, data: (versions ?? []) as Documentation[] };
}

/**
 * Get the latest completed documentation version for a repository
 */
export async function getLatestDocumentation(
  repoId: string,
): Promise<ActionResult<Documentation>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  const { data: documentation, error } = await client
    .from("documentation")
    .select("*")
    .eq("repo_id", repoId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (!documentation) {
    return { success: false, error: "Documentation not found" };
  }

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  return { success: true, data: documentation as Documentation };
}

/**
 * Get documentation pages for a specific version
 */
export async function getDocPagesForVersion(
  repoId: string,
  version: number,
): Promise<ActionResult<DocPage[]>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  // Get the documentation record for this version
  const { data: documentation, error: docError } = await client
    .from("documentation")
    .select("id")
    .eq("repo_id", repoId)
    .eq("version", version)
    .single();

  if (docError || !documentation) {
    return { success: false, error: "Documentation version not found" };
  }

  const { data: pages, error } = await client
    .from("pages")
    .select("*")
    .eq("documentation_id", documentation.id)
    .order("order_index", { ascending: true });

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  return { success: true, data: (pages ?? []) as DocPage[] };
}

// ============================================================================
// Conversation Services
// ============================================================================

export async function getConversations(
  repoId: string,
  limit: number = 20,
  version: number | null = null,
): Promise<ActionResult<Conversation[]>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  let query = client
    .from("conversations")
    .select("*")
    .eq("repo_id", repoId)
    .eq("user_id", user.id);

  // Filter by version if specified
  if (version !== null && version !== undefined) {
    query = query.eq("repo_version", version);
  }

  const { data: conversations, error } = await query
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  return { success: true, data: (conversations ?? []) as Conversation[] };
}

export async function getConversationById(
  conversationId: string,
): Promise<ActionResult<Conversation>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  const { data: conversation, error } = await client
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .single();

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  if (!conversation) {
    return { success: false, error: "Conversation not found" };
  }

  return { success: true, data: conversation as Conversation };
}

export async function createConversation(
  repoId: string,
  title?: string,
  version?: number | null,
): Promise<ActionResult<Conversation>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  const { data: conversation, error } = await client
    .from("conversations")
    .insert({
      repo_id: repoId,
      user_id: user.id,
      title: title || "New Conversation",
      repo_version: version ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  return { success: true, data: conversation as Conversation };
}

export async function deleteConversation(
  conversationId: string,
): Promise<ActionResult<void>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  const { error } = await client
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", user.id);

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  return { success: true, data: undefined };
}

export async function renameConversation(
  conversationId: string,
  newTitle: string,
): Promise<ActionResult<Conversation>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  const { data: conversation, error } = await client
    .from("conversations")
    .update({ title: newTitle })
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  return { success: true, data: conversation as Conversation };
}

// ============================================================================
// Message Services
// ============================================================================

export async function getConversationMessages(
  conversationId: string,
): Promise<ActionResult<ConversationMessage[]>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  const { data: messages, error } = await client
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  return { success: true, data: (messages ?? []) as ConversationMessage[] };
}

export async function createMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
): Promise<ActionResult<ConversationMessage>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  const { data: message, error } = await client
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role,
      content,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  // Update the conversation's updated_at timestamp
  await client
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return { success: true, data: message as ConversationMessage };
}

export async function saveCodeSnippets(
  conversationId: string,
  messageId: string,
  snippets: Array<{ file: string; code: string }>,
): Promise<ActionResult<CodeSnippet[]>> {
  const supabase = await createClient();

  const snippetsToInsert = snippets.map((snippet) => ({
    conversation_id: conversationId,
    message_id: messageId,
    file_path: snippet.file,
    code_content: snippet.code,
    language: snippet.file.split(".").pop() || null,
  }));

  const { data, error } = await supabase
    .from("code_snippets")
    .insert(snippetsToInsert)
    .select();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: data as CodeSnippet[] };
}

export async function getCodeSnippetsForConversation(
  conversationId: string,
): Promise<ActionResult<CodeSnippet[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("code_snippets")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: data as CodeSnippet[] };
}

export async function deleteCodeSnippet(
  snippetId: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("code_snippets")
    .delete()
    .eq("id", snippetId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: null };
}

export async function indexRepository(
  repoId: string,
): Promise<ActionResult<void>> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated!" };
  }

  const { data: installation, error: installationError } = await client
    .from("github_installations")
    .select("*")
    .eq("installed_by", user.id)
    .single();

  if (!installation || installationError) {
    return { success: false, error: "Github App Installation not found!" };
  }

  //fetch repo

  const repoResult = await getRepoWithStatus(repoId);

  if (!repoResult.success) {
    return { success: false, error: repoResult.error };
  }

  const repoUrl = repoResult.data.repo_url;
  const installationId = installation.installation_id;

  // Get the latest version number for this repo
  const { data: latestDoc } = await client
    .from("documentation")
    .select("version")
    .eq("repo_id", repoId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  // Increment version (start at 1 if no previous versions)
  const nextVersion = (latestDoc?.version ?? 0) + 1;

  //mark the repository as indexing in supabase first
  const { error: updateError } = await client
    .from("repositories")
    .update({ index_status: "indexing" })
    .eq("id", repoId);

  if (updateError) {
    console.error(updateError);
    return { success: false, error: updateError.message };
  }

  // Call the backend to start indexing (fire-and-forget)
  // Don't await or throw errors since this is a long-running operation
  fetch(`${process.env.BACKEND_URL}/repos/index`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      repo_url: repoUrl,
      repo_id: repoId,
      user_id: user.id,
      installation_id: installationId,
      branch: "main",
      version: nextVersion,
    }),
  }).catch((error) => {
    // Log the error but don't fail the request
    console.error("Indexing request failed:", error);
    // The backend should handle updating the repo status on failure
  });

  // Return success immediately - the indexing will happen in the background
  return { success: true, data: undefined };
}
