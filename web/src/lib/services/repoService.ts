"use server";

import {
  authed,
  createClient,
  NOT_AUTHED,
  toResult,
} from "@/utils/supabase/server";
import {
  Repo,
  Documentation,
  DocPage,
  Conversation,
  ConversationMessage,
  CodeSnippet,
} from "@/app/types/supabase";
import { ActionResult } from "@/app/types/action";
import { githubSlug } from "@/lib/repoHref";
import { verifyGithubRepoAccess } from "./gitProviderService";
import {
  OAUTH,
  getProviderToken,
  isOAuthProvider,
  lookupRepo,
} from "@/lib/gitOAuth";

type Client = Awaited<ReturnType<typeof createClient>>;

// owner/repo from https://github.com/owner/repo(.git)(/...) or git@github.com:owner/repo.git
function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const m = url.match(/github\.com[/:]([^/]+)\/([^/?#]+)/i);
  return { owner: m?.[1] ?? "", repo: m?.[2]?.replace(/\.git$/, "") ?? "" };
}

// The insert every createRepoVia* action ends with
async function insertRepo(
  client: Client,
  userId: string,
  orgId: string,
  fields: {
    name: string;
    provider: string;
    repo_url: string | null;
    object_url?: string;
  },
): Promise<ActionResult<Repo>> {
  return toResult<Repo>(
    await client
      .from("repositories")
      .insert({
        ...fields,
        organization_id: orgId,
        indexed_by: userId,
        index_status: "not indexed",
      })
      .select()
      .single(),
  );
}

export async function getReposByOrganizationId(
  organizationId: string,
): Promise<ActionResult<Repo[]>> {
  const { client, user } = await authed();
  if (!user) return NOT_AUTHED;

  return toResult<Repo[]>(
    await client
      .from("repositories")
      .select("*")
      .eq("organization_id", organizationId),
  );
}

export async function createRepoViaGithub(
  formData: FormData,
  orgId: string,
): Promise<ActionResult<Repo>> {
  const { client, user } = await authed();
  if (!user) return NOT_AUTHED;

  const name = formData.get("name") as string;
  const provider = formData.get("type") as string;
  const url = formData.get("repo-url") as string;

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
    return { success: false, error: "Installation Needed" };
  }

  const { owner, repo } = parseGitHubUrl(url);
  const hasAccess = await verifyGithubRepoAccess(
    installation.installation_id,
    owner,
    repo,
  );

  if (!hasAccess) {
    return { success: false, error: "Access Denied" };
  }

  return insertRepo(client, user.id, orgId, { name, provider, repo_url: url });
}

export async function createRepoViaOAuthProvider(
  formData: FormData,
  orgId: string,
): Promise<ActionResult<Repo>> {
  const { client, user } = await authed();
  if (!user) return NOT_AUTHED;

  const name = (formData.get("name") as string)?.trim();
  const provider = formData.get("type") as string;
  const url = (formData.get("repo-url") as string)?.trim();

  if (!name) {
    return { success: false, error: "Name is required!" };
  }

  if (!isOAuthProvider(provider)) {
    return { success: false, error: "Unsupported provider" };
  }

  const { label } = OAUTH[provider];

  if (!url) {
    return { success: false, error: `${label} URL is required` };
  }

  const token = await getProviderToken(provider);

  if (!token) {
    return { success: false, error: "Installation Needed" };
  }

  // Store the canonical URL the backend clones from
  const repoUrl = await lookupRepo(provider, url, token);

  if (!repoUrl) {
    return {
      success: false,
      error: `Couldn't find that repository on ${label}, or your account can't access it.`,
    };
  }

  return insertRepo(client, user.id, orgId, {
    name,
    provider,
    repo_url: repoUrl,
  });
}

// Public Mercurial repos only: no host has a standard OAuth flow, so nothing to verify against
export async function createRepoViaMercurial(
  formData: FormData,
  orgId: string,
): Promise<ActionResult<Repo>> {
  const { client, user } = await authed();
  if (!user) return NOT_AUTHED;

  const name = (formData.get("name") as string)?.trim();
  const url = (formData.get("repo-url") as string)?.trim().replace(/\/+$/, "");

  if (!name) {
    return { success: false, error: "Name is required!" };
  }

  // The backend refuses anything else too (ssh:// and file paths would run on the server)
  if (!url?.startsWith("https://")) {
    return { success: false, error: "Mercurial URL must start with https://" };
  }

  return insertRepo(client, user.id, orgId, {
    name,
    provider: "mercurial",
    repo_url: url,
  });
}

export async function createRepoViaLocalFile(
  formData: FormData,
  orgId: string,
): Promise<ActionResult<Repo>> {
  const { client, user } = await authed();
  if (!user) return NOT_AUTHED;

  const name = (formData.get("name") as string)?.trim();
  const file = formData.get("file") as File;

  if (!name) {
    return { success: false, error: "Repository name is required" };
  }

  if (!file) {
    return { success: false, error: "File is required" };
  }

  if (!file.name.endsWith(".zip")) {
    return { success: false, error: "Only .zip files are allowed" };
  }

  if (file.size > 100 * 1024 * 1024) {
    return { success: false, error: "File size exceeds 100MB limit" };
  }

  try {
    // Unique path so uploads never collide
    const sanitizedName = name.replace(/[^a-z0-9-_]/gi, "_");
    const filePath = `${orgId}/${sanitizedName}_${Date.now()}_${file.name}`;

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

    const result = await insertRepo(client, user.id, orgId, {
      name,
      provider: "local",
      repo_url: null,
      object_url: filePath, // path in the private local_repos bucket
    });

    if (!result.success) {
      // Don't leave an orphaned upload behind
      await client.storage.from("local_repos").remove([filePath]);
      return {
        success: false,
        error: `Repository creation failed: ${result.error}`,
      };
    }

    return result;
  } catch (error) {
    console.error("Unexpected error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

export async function getRepoWithStatus(
  repoId: string,
): Promise<ActionResult<Repo>> {
  const { client, user } = await authed();
  if (!user) return NOT_AUTHED;

  return toResult<Repo>(
    await client.from("repositories").select("*").eq("id", repoId).single(),
  );
}

// Unsticks a repo whose backend run died (restart, crash) and left it "indexing" forever.
// ponytail: only flips the status, a still-running backend job isn't killed and will mark it indexed when done
export async function cancelIndexing(
  repoId: string,
): Promise<ActionResult<void>> {
  const { client, user } = await authed();
  if (!user) return NOT_AUTHED;

  return toResult<void>(
    await client
      .from("repositories")
      .update({
        index_status: "failed",
        metadata: { index_error: "Indexing was cancelled." },
      })
      .eq("id", repoId)
      .eq("index_status", "indexing"),
  );
}

// Resolve /dashboard/<owner>/<repo> to a repo id. RLS limits rows to the user's orgs.
// ponytail: same GitHub repo in two of the user's orgs -> newest wins; add ?org= if that bites
export async function getRepoIdByGithubSlug(
  owner: string,
  name: string,
): Promise<string | null> {
  const client = await createClient();
  const { data } = await client
    .from("repositories")
    .select("id, repo_url")
    .ilike("repo_url", `%github.com/${owner}/${name}%`)
    .order("created_at", { ascending: false });

  const match = (data ?? []).find((r) => {
    const slug = githubSlug(r.repo_url);
    return (
      slug?.[0].toLowerCase() === owner.toLowerCase() &&
      slug?.[1].toLowerCase() === name.toLowerCase()
    );
  });
  return match?.id ?? null;
}

export async function updateRepoSettings(
  repoId: string,
  settings: { name?: string; repo_url?: string; file?: File },
): Promise<ActionResult<Repo>> {
  const { client, user } = await authed();
  if (!user) return NOT_AUTHED;

  // Get the current repo to check its provider type
  const { data: currentRepo } = await client
    .from("repositories")
    .select("*")
    .eq("id", repoId)
    .single();

  if (!currentRepo) {
    return { success: false, error: "Repository not found!" };
  }

  const updateData: Record<string, string> = {};
  const provider: string = currentRepo.provider;

  if (settings.name) {
    updateData.name = settings.name;
  }

  if (settings.repo_url && provider === "github") {
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
  } else if (settings.repo_url && isOAuthProvider(provider)) {
    const { label } = OAUTH[provider];
    const token = await getProviderToken(provider);

    if (!token) {
      return { success: false, error: `Reconnect ${label} first!` };
    }

    const repoUrl = await lookupRepo(provider, settings.repo_url, token);

    if (!repoUrl) {
      return {
        success: false,
        error: `Cannot access this repository on ${label}.`,
      };
    }

    updateData.repo_url = repoUrl;
    updateData.index_status = "not indexed"; // Trigger re-indexing
  } else if (settings.repo_url && provider === "mercurial") {
    if (!settings.repo_url.startsWith("https://")) {
      return { success: false, error: "Mercurial URL must start with https://" };
    }

    updateData.repo_url = settings.repo_url.trim().replace(/\/+$/, "");
    updateData.index_status = "not indexed"; // Trigger re-indexing
  }

  if (settings.file && provider === "local") {
    if (!settings.file.name.endsWith(".zip")) {
      return { success: false, error: "Only .zip files are allowed!" };
    }

    const fileName = `${repoId}-${Date.now()}.zip`;
    const { error: uploadError } = await client.storage
      .from("local_repos")
      .upload(fileName, settings.file);

    if (uploadError) {
      console.error(uploadError);
      return { success: false, error: "Failed to upload file!" };
    }

    updateData.object_url = fileName; // path in the private local_repos bucket
    updateData.index_status = "pending"; // Trigger re-indexing
  }

  return toResult<Repo>(
    await client
      .from("repositories")
      .update(updateData)
      .eq("id", repoId)
      .select()
      .single(),
  );
}

export async function deleteRepo(
  repoId: string,
): Promise<ActionResult<{ organizationId: string }>> {
  const { client, user } = await authed();
  if (!user) return NOT_AUTHED;

  // Fetch the organization_id before deleting
  const repo = toResult<{ organization_id: string }>(
    await client
      .from("repositories")
      .select("organization_id")
      .eq("id", repoId)
      .single(),
  );
  if (!repo.success) return repo;

  const deleted = toResult(
    await client.from("repositories").delete().eq("id", repoId),
  );
  if (!deleted.success) return deleted;

  return { success: true, data: { organizationId: repo.data.organization_id } };
}

// All documentation versions for a repository, newest first
export async function getDocumentationVersions(
  repoId: string,
): Promise<ActionResult<Documentation[]>> {
  const { client, user } = await authed();
  if (!user) return NOT_AUTHED;

  return toResult<Documentation[]>(
    await client
      .from("documentation")
      .select("*")
      .eq("repo_id", repoId)
      .order("version", { ascending: false }),
  );
}

export async function getLatestDocumentation(
  repoId: string,
): Promise<ActionResult<Documentation>> {
  const { client, user } = await authed();
  if (!user) return NOT_AUTHED;

  const { data } = await client
    .from("documentation")
    .select("*")
    .eq("repo_id", repoId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  return data
    ? { success: true, data: data as Documentation }
    : { success: false, error: "Documentation not found" };
}

export async function getDocPagesForVersion(
  repoId: string,
  version: number,
): Promise<ActionResult<DocPage[]>> {
  const { client, user } = await authed();
  if (!user) return NOT_AUTHED;

  const { data: documentation } = await client
    .from("documentation")
    .select("id")
    .eq("repo_id", repoId)
    .eq("version", version)
    .single();

  if (!documentation) {
    return { success: false, error: "Documentation version not found" };
  }

  return toResult<DocPage[]>(
    await client
      .from("pages")
      .select("*")
      .eq("documentation_id", documentation.id)
      .order("order_index", { ascending: true }),
  );
}

export async function getConversations(
  repoId: string,
  limit: number = 20,
  version: number | null = null,
): Promise<ActionResult<Conversation[]>> {
  const { client, user } = await authed();
  if (!user) return NOT_AUTHED;

  let query = client
    .from("conversations")
    .select("*")
    .eq("repo_id", repoId)
    .eq("user_id", user.id);

  if (version !== null && version !== undefined) {
    query = query.eq("repo_version", version);
  }

  return toResult<Conversation[]>(
    await query.order("updated_at", { ascending: false }).limit(limit),
  );
}

export async function getConversationById(
  conversationId: string,
): Promise<ActionResult<Conversation>> {
  const { client, user } = await authed();
  if (!user) return NOT_AUTHED;

  return toResult<Conversation>(
    await client
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single(),
  );
}

export async function createConversation(
  repoId: string,
  title?: string,
  version?: number | null,
): Promise<ActionResult<Conversation>> {
  const { client, user } = await authed();
  if (!user) return NOT_AUTHED;

  return toResult<Conversation>(
    await client
      .from("conversations")
      .insert({
        repo_id: repoId,
        user_id: user.id,
        title: title || "New Conversation",
        repo_version: version ?? null,
      })
      .select()
      .single(),
  );
}

export async function getConversationMessages(
  conversationId: string,
): Promise<ActionResult<ConversationMessage[]>> {
  const { client, user } = await authed();
  if (!user) return NOT_AUTHED;

  return toResult<ConversationMessage[]>(
    await client
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
  );
}

export async function createMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
): Promise<ActionResult<ConversationMessage>> {
  const { client, user } = await authed();
  if (!user) return NOT_AUTHED;

  const result = toResult<ConversationMessage>(
    await client
      .from("messages")
      .insert({ conversation_id: conversationId, role, content })
      .select()
      .single(),
  );

  if (result.success) {
    // Bump the conversation so it sorts first in Recents
    await client
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
  }

  return result;
}

export async function saveCodeSnippets(
  conversationId: string,
  messageId: string,
  snippets: Array<{ file: string; code: string }>,
): Promise<ActionResult<CodeSnippet[]>> {
  const client = await createClient();

  return toResult<CodeSnippet[]>(
    await client
      .from("code_snippets")
      .insert(
        snippets.map((snippet) => ({
          conversation_id: conversationId,
          message_id: messageId,
          file_path: snippet.file,
          code_content: snippet.code,
          language: snippet.file.split(".").pop() || null,
        })),
      )
      .select(),
  );
}

export async function getCodeSnippetsForConversation(
  conversationId: string,
): Promise<ActionResult<CodeSnippet[]>> {
  const client = await createClient();

  return toResult<CodeSnippet[]>(
    await client
      .from("code_snippets")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false }),
  );
}

export async function indexRepository(
  repoId: string,
): Promise<ActionResult<void>> {
  const { client, user } = await authed();
  if (!user) return NOT_AUTHED;

  const repoResult = await getRepoWithStatus(repoId);

  if (!repoResult.success) {
    return repoResult;
  }

  const { provider, repo_url: repoUrl } = repoResult.data;

  // Clone credentials, or where the uploaded zip lives
  let auth:
    | { installation_id: string }
    | { access_token: string }
    | { object_path: string; name: string }
    | Record<string, never>; // public Mercurial: nothing needed

  if (provider === "github") {
    const { data: installation } = await client
      .from("github_installations")
      .select("installation_id")
      .eq("installed_by", user.id)
      .maybeSingle();

    if (!installation) {
      return { success: false, error: "Github App Installation not found!" };
    }
    auth = { installation_id: String(installation.installation_id) };
  } else if (isOAuthProvider(provider)) {
    const token = await getProviderToken(provider);

    if (!token) {
      return {
        success: false,
        error: `Reconnect ${OAUTH[provider].label} to index this repository.`,
      };
    }
    auth = { access_token: token };
  } else if (provider === "mercurial") {
    auth = {};
  } else if (provider === "local" && repoResult.data.object_url) {
    auth = {
      object_path: repoResult.data.object_url,
      name: repoResult.data.name,
    };
  } else {
    return { success: false, error: "This repository has nothing to index." };
  }

  // Next version number (1 if there are none yet)
  const { data: latestDoc } = await client
    .from("documentation")
    .select("version")
    .eq("repo_id", repoId)
    .order("version", { ascending: false })
    .limit(1)
    .single();
  const nextVersion = (latestDoc?.version ?? 0) + 1;

  // Mark the repository as indexing first (clearing any previous error).
  // indexed_by: the backend stores the index under this user, and chat reads it from there
  const marked = toResult(
    await client
      .from("repositories")
      .update({ index_status: "indexing", metadata: null, indexed_by: user.id })
      .eq("id", repoId),
  );
  if (!marked.success) return marked;

  // Fire-and-forget: indexing is long-running, so don't await the run itself
  const request = fetch(`${process.env.BACKEND_URL}/repos/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repo_url: repoUrl,
      repo_id: repoId,
      user_id: user.id,
      provider,
      ...auth,
      version: nextVersion,
    }),
  });

  // An unreachable backend rejects within milliseconds; failures after that
  // are recorded on the repo by the backend itself.
  const unreachable = await Promise.race([
    request.then(
      () => false,
      (error) => {
        console.error("Indexing request failed:", error);
        return true;
      },
    ),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
  ]);

  if (unreachable) {
    const message =
      "Could not reach the indexing service. Make sure the backend is running.";
    await client
      .from("repositories")
      .update({ index_status: "failed", metadata: { index_error: message } })
      .eq("id", repoId);
    return { success: false, error: message };
  }

  return { success: true, data: undefined };
}
