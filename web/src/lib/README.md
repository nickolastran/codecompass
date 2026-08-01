# Lib Directory

This directory contains core business logic, server actions, and client-side state management for CodeCompass.

## Overview

The lib directory is organized into:
- **Services**: Server actions for Supabase operations and external integrations
- **Stores**: Zustand stores for client-side UI state
- **Actions**: Server action wrapper layer
- **Utils**: Shared utility functions

## Directory Structure

```
lib/
├── actions/                    # Server action wrappers
│   └── gitlab.ts
├── services/                   # Core business logic
│   ├── orgService.ts          # Organization operations
│   ├── repoService.ts         # Repository, docs, chat operations
│   ├── gitProviderService.ts  # GitHub/GitLab integration
│   └── orgCache.ts            # Organization caching
├── stores/                     # Zustand client state
│   ├── useChatUIStore.ts
│   ├── useNavbarStore.ts
│   ├── useDocumentationStore.ts
│   └── useDashboardStore.ts
├── utils/                      # Empty (reserved)
└── utils.ts                    # Core utilities
```

## Core Utilities (`utils.ts`)

**Location**: `src/lib/utils.ts`

**Exports**:

### cn()
Combines clsx + tailwind-merge for conditional Tailwind classes with proper specificity.

```typescript
import { cn } from "@/lib/utils";

<div className={cn(
  "base-class",
  isActive && "active-class",
  "override-class"
)} />
```

### formatRelativeTime()
Formats timestamps as relative time strings.

```typescript
formatRelativeTime("2024-01-15T10:00:00Z")
// → "2 hours ago"
// → "3 days ago"
// → "1 month ago"
```

---

## Services

All services use `"use server"` and return `ActionResult<T>` for consistent error handling.

### ActionResult Pattern

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

**Usage**:
```typescript
const result = await createOrg(formData);
if (!result.success) {
  setError(result.error);
  return;
}
// TypeScript knows result.data is available
console.log(result.data.id);
```

---

### orgService.ts - Organization Management

**Location**: `src/lib/services/orgService.ts`

**Purpose**: All organization-related operations.

#### Organization Operations

| Function | Purpose | Returns |
|----------|---------|---------|
| `getOrgs()` | Fetch user's orgs with roles | `ActionResult<OrganizationWithRole[]>` |
| `getOrgById(orgId)` | Get single organization | `ActionResult<Organization>` |
| `createOrg(formData)` | Create new org | `ActionResult<Organization>` |

#### Member Management

| Function | Purpose | Returns |
|----------|---------|---------|
| `getOrgMembers(orgId)` | Get org members with emails | `ActionResult<OrganizationMember[]>` |
| `createInviteLink(orgId)` | Generate 7-day invite token | `ActionResult<string>` |
| `acceptInvite(token)` | Join org via invite | `ActionResult<void>` |
| `removeMemberFromOrg(orgId, userIdToRemove)` | Remove member (owners only) | `ActionResult<void>` |
| `leaveOrganization(orgId)` | User leaves org | `ActionResult<void>` |
| `updateMemberRole(orgId, userId, role)` | Change role (owner/teammate) | `ActionResult<void>` |

**Key Features**:
- Access control validation (ownership/membership checks)
- Prevents removing last owner
- Invite token expiration (7 days)
- Email joins for member display

**Usage Example**:
```typescript
const result = await createOrg(formData);
if (result.success) {
  router.push(`/dashboard/org/${result.data.id}`);
}
```

---

### repoService.ts - Repository & Documentation

**Location**: `src/lib/services/repoService.ts`

**Purpose**: Comprehensive repository, documentation, and chat operations.

#### Repository Creation

| Function | Purpose | Returns |
|----------|---------|---------|
| `createRepoViaGithub(formData, orgId)` | Create from GitHub URL | `ActionResult<Repo>` |
| `createRepoViaGitlab(formData, orgId)` | Create from GitLab URL | `ActionResult<Repo>` |
| `createRepoViaLocalFile(formData, orgId)` | Upload .zip (max 100MB) | `ActionResult<Repo>` |

**Key Features**:
- GitHub App installation verification
- GitLab OAuth token validation
- Supabase Storage upload (`local_repos` bucket)
- URL parsing (supports HTTPS, SSH, .git suffix)

#### Repository Management

| Function | Purpose | Returns |
|----------|---------|---------|
| `getReposByOrganizationId(orgId)` | List org repos | `ActionResult<Repo[]>` |
| `getRepoWithStatus(repoId)` | Get repo with index status | `ActionResult<Repo>` |
| `updateRepoSettings(repoId, settings)` | Update name/URL/file | `ActionResult<Repo>` |
| `deleteRepo(repoId)` | Delete repository | `ActionResult<{organizationId: string}>` |
| `triggerReindex(repoId)` | Mark for reindexing | `ActionResult<void>` |
| `indexRepository(repoId, reindex?)` | Trigger backend indexing | `ActionResult<void>` |

**Index Statuses**: `"pending"`, `"processing"`, `"completed"`, `"failed"`, `null`

**Indexing Flow**:
1. `indexRepository()` marks repo as `"indexing"` in DB
2. Fire-and-forget POST to `${BACKEND_URL}/repos/index`
3. Backend processes and updates status
4. Returns immediately (background operation)

#### Documentation Services

| Function | Purpose | Returns |
|----------|---------|---------|
| `getDocumentation(repoId)` | Get doc record | `ActionResult<Documentation>` |
| `getDocPages(repoId)` | Get all pages (latest) | `ActionResult<DocPage[]>` |
| `getDocPageById(pageId)` | Get single page | `ActionResult<DocPage>` |
| `getDocPagesHierarchical(repoId)` | Get pages with hierarchy | `ActionResult<FileTreeNode[]>` |
| `getDocumentationVersions(repoId)` | Get all versions | `ActionResult<Documentation[]>` |
| `getLatestDocumentation(repoId)` | Get newest version | `ActionResult<Documentation>` |
| `getDocPagesForVersion(repoId, version)` | Get pages for version | `ActionResult<DocPage[]>` |

**Version Management**:
- Each reindex creates new version (auto-incremented)
- Versions track `created_at`, `updated_at`
- Users can switch between versions

#### Conversation Services

| Function | Purpose | Returns |
|----------|---------|---------|
| `getConversations(repoId, limit?, version?)` | Get user's conversations | `ActionResult<Conversation[]>` |
| `getConversationById(conversationId)` | Get single conversation | `ActionResult<Conversation>` |
| `createConversation(repoId, title?, version?)` | Start new chat | `ActionResult<Conversation>` |
| `deleteConversation(conversationId)` | Delete conversation | `ActionResult<void>` |
| `renameConversation(conversationId, title)` | Update title | `ActionResult<Conversation>` |

**Default Limit**: 10 most recent conversations

#### Message Services

| Function | Purpose | Returns |
|----------|---------|---------|
| `getConversationMessages(conversationId)` | Get all messages | `ActionResult<ConversationMessage[]>` |
| `createMessage(conversationId, role, content)` | Add message | `ActionResult<ConversationMessage>` |
| `saveCodeSnippets(conversationId, messageId, snippets)` | Save code blocks | `ActionResult<CodeSnippet[]>` |
| `getCodeSnippetsForConversation(conversationId)` | Get saved snippets | `ActionResult<CodeSnippet[]>` |
| `deleteCodeSnippet(snippetId)` | Delete snippet | `ActionResult<void>` |

**Message Roles**: `"user"` or `"assistant"`

**Code Snippet Structure**:
```typescript
{
  conversation_id: string;
  message_id: string;
  file_path: string;
  code_content: string;
  language: string;
}
```

#### Helper Functions

```typescript
parseGitHubUrl(url: string): { owner: string; repo: string } | null
// Supports: https://github.com/owner/repo, git@github.com:owner/repo.git

parseGitLabUrl(url: string): { owner: string; repo: string } | null
// Supports: https://gitlab.com/group/subgroup/repo, nested groups, self-hosted
```

---

### gitProviderService.ts - Git Provider Integration

**Location**: `src/lib/services/gitProviderService.ts`

**Purpose**: Verify repository access and manage provider installations.

#### GitHub Integration

| Function | Purpose | Returns |
|----------|---------|---------|
| `verifyGithubRepoAccess(installationId, owner, repo)` | Check app access | `ActionResult<boolean>` |

**Uses**: GitHub App installation tokens via Octokit

#### GitLab Integration

| Function | Purpose | Returns |
|----------|---------|---------|
| `verifyGitLabRepoAccess(token, owner, name)` | Check token access | `ActionResult<boolean>` |
| `fetchGitLabProjects(token)` | Get user's projects | `ActionResult<GitLabProject[]>` |
| `importGitLabProjects(projects, orgId)` | Bulk import repos | `ActionResult<void>` |

**GitLab Project Structure**:
```typescript
{
  id: number;
  name: string;
  path_with_namespace: string;
  http_url_to_repo: string;
}
```

**Key Features**:
- OAuth token bearer auth
- Membership filtering (only user's projects)
- Duplicate prevention during import
- Graceful error handling for batch operations

---

### orgCache.ts - Organization Caching

**Location**: `src/lib/services/orgCache.ts`

**Purpose**: Optimize organization data loading with React Query caching.

| Function | Purpose |
|----------|---------|
| `prefetchOrgData(orgId, queryClient)` | Fetch access + details in parallel, cache both |
| `getOrgAccess(orgId, userId)` | Get cached org access level |
| `getOrgDetails(orgId)` | Get cached org details |

**Cache Keys**:
- Access: `["organization", "access", orgId, userId]`
- Details: `["organization", "details", orgId]`

**Usage**:
```typescript
const queryClient = useQueryClient();
await prefetchOrgData(orgId, queryClient);

// Later access from cache
const access = await queryClient.fetchQuery({
  queryKey: ["organization", "access", orgId, userId],
  queryFn: () => getOrgAccess(orgId, userId)
});
```

---

## Actions

### gitlab.ts - GitLab Import Action

**Location**: `src/lib/actions/gitlab.ts`

**Purpose**: Wrapper server action for GitLab project imports.

```typescript
"use server"
export async function importGitLabRepositories(
  projects: GitLabProject[],
  orgId: string
): Promise<ActionResult<void>>
```

**Delegates to**: `gitProviderService.importGitLabProjects()`

---

## Zustand Stores

All stores are located in `src/lib/stores/`. See `src/hooks/README.md` for detailed documentation.

### Quick Reference

| Store | Purpose | Key State |
|-------|---------|-----------|
| `useChatUIStore` | Chat interface UI | `isExpanded`, `selectedModel`, `conversation` |
| `useNavbarStore` | Navigation breadcrumbs | `contextText`, `breadcrumbs` |
| `useDocumentationStore` | Documentation viewer | `selectedVersion`, `isLoading`, `isIndexing` |
| `useDashboardStore` | Dashboard state | Empty (placeholder) |

**Usage Pattern**:
```typescript
// Selector pattern (recommended)
const isExpanded = useChatUIStore((state) => state.isExpanded);
const expand = useChatUIStore((state) => state.expand);

// Destructuring (less optimal)
const { isExpanded, expand } = useChatUIStore();
```

---

## Design Patterns

### 1. Error Handling

All services follow `ActionResult<T>` pattern:
```typescript
const result = await someService();
if (!result.success) {
  // Handle error
  return;
}
// Access result.data safely
```

### 2. Authentication

All services check authentication:
```typescript
const client = await createClient();
const { data: { user } } = await client.auth.getUser();
if (!user) {
  return { success: false, error: "User not authenticated!" };
}
```

### 3. Access Control

Services validate user access:
```typescript
// Check org membership
const { data: membership } = await client
  .from("user_organizations")
  .select("role")
  .eq("organization_id", orgId)
  .eq("user_id", userId)
  .single();

if (!membership) {
  return { success: false, error: "Access denied" };
}
```

### 4. Query Invalidation

After mutations, invalidate React Query cache:
```typescript
import { revalidatePath } from "next/cache";

// In server action
await createRepo(...);
revalidatePath("/dashboard/organizations");
```

### 5. Parallel Fetching

Use Promise.all for performance:
```typescript
const [orgAccess, orgDetails] = await Promise.all([
  getOrgAccess(orgId, userId),
  getOrgDetails(orgId)
]);
```

---

## State Management Strategy

| Type | Use Case | Location |
|------|----------|----------|
| **Server Actions** | Data mutations (create, update, delete) | `lib/services/` |
| **React Query** | Server state caching | Components via `useQuery()` |
| **Zustand** | Client UI state (modals, navigation) | `lib/stores/` |
| **React Context** | Shared component tree data | Component providers |

---

## Environment Variables

Services use the following environment variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_SECRET_KEY=your-service-role-key

# Backend
BACKEND_URL=http://localhost:8000

# GitHub App
NEXT_PUBLIC_GITHUB_APP_CLIENT_ID=your-app-id
GITHUB_APP_CLIENT_ID=your-oauth-client-id
GITHUB_APP_CLIENT_SECRET=your-oauth-secret
GITHUB_APP_PRIVATE_KEY_PATH=./github-app-private-key.pem

# GitLab OAuth
GITLAB_CLIENT_ID=your-gitlab-client-id
GITLAB_CLIENT_SECRET=your-gitlab-client-secret
```

---

## Data Flow

```
Component
  ↓
Server Action (orgService, repoService)
  ↓
Supabase Client (validate auth, check access)
  ↓
Database Query (insert, update, select)
  ↓
ActionResult<T> (return to component)
  ↓
React Query Cache Invalidation
  ↓
UI Update
```

---

## Best Practices

1. **Always return ActionResult**: Never throw errors in server actions
2. **Validate authentication**: Check user in all server actions
3. **Check access control**: Verify user has permission for operation
4. **Use typed data**: Leverage TypeScript for safety
5. **Invalidate cache**: Call `revalidatePath()` after mutations
6. **Parallel queries**: Use Promise.all when fetching independent data
7. **Graceful errors**: Provide helpful error messages to users

---

## Related Documentation

- App Routes: `src/app/README.md`
- Components: `src/components/README.md`
- Hooks: `src/hooks/README.md`
- Utilities: `src/utils/README.md`
