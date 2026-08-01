# App Directory

This directory contains the Next.js 15 App Router structure for CodeCompass, including all routes, layouts, API endpoints, and type definitions.

## Overview

The app directory follows Next.js App Router conventions with:
- Server Components by default for optimal performance
- Client Components (`"use client"`) for interactivity
- Server Actions for secure data mutations
- Dynamic routes with Promise-based params (Next.js 15)
- Route groups for logical organization without URL nesting

## Directory Structure

```
app/
├── (auth)/                      # Auth route group (hidden from URL)
│   ├── login/                   # OTP + OAuth login page
│   └── actions.ts              # Login server action
├── api/                        # API routes
│   ├── auth/callback/          # OTP magic link handler
│   ├── chat/                   # LLM streaming endpoint
│   ├── github/installation/    # GitHub App OAuth
│   └── gitlab/installation/    # GitLab OAuth
├── dashboard/                  # Protected dashboard routes
│   ├── organizations/          # Org list view
│   ├── org/[id]/              # Org detail + team management
│   ├── repo/[id]/             # Repo documentation + chat
│   ├── new/                   # Create org/repo forms
│   └── install-*/             # GitHub/GitLab app guides
├── docs/                      # Public documentation site
├── invite/[token]/            # Organization invite acceptance
├── types/                     # TypeScript definitions
│   ├── supabase.ts           # Database types
│   └── action.ts             # ActionResult<T> pattern
├── layout.tsx                # Root layout with providers
├── page.tsx                  # Landing page
└── globals.css               # Tailwind CSS + theme variables
```

## Key Routes

### Public Routes

| Route | Purpose |
|-------|---------|
| `/` | Landing page with hero, features, CTA |
| `/(auth)/login` | Email OTP + GitHub/GitLab OAuth login |
| `/docs/self-hosting` | Self-hosting documentation |
| `/invite/[token]` | Accept organization invites |
| `/error` | Generic error fallback |

### Protected Routes (Dashboard)

| Route | Purpose |
|-------|---------|
| `/dashboard` | Dashboard home with quick actions |
| `/dashboard/organizations` | List user's organizations |
| `/dashboard/org/[id]` | Organization detail + repositories |
| `/dashboard/org/[id]/team` | Team member management |
| `/dashboard/org/[id]/settings` | Organization settings |
| `/dashboard/repo/[id]` | Documentation viewer + AI chat |
| `/dashboard/repo/[id]/settings` | Repository settings |
| `/dashboard/new` | Create organization form |
| `/dashboard/new/[id]` | Create repository in org |

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/callback` | GET | OTP magic link callback |
| `/api/chat` | POST | LLM streaming (Server-Sent Events) |
| `/api/github/installation` | GET, POST | GitHub App OAuth + webhooks |
| `/api/gitlab/installation` | GET | GitLab OAuth callback |

## Architecture Patterns

### 1. Server Components (Default)

```tsx
// Server Component - async data fetching
export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.from('table').select();
  return <div>{data}</div>;
}
```

**Used for**: Data fetching, authentication checks, SEO-critical pages

### 2. Client Components

```tsx
"use client"
export function InteractiveComponent() {
  const [state, setState] = useState();
  return <button onClick={() => {}}>Click</button>;
}
```

**Used for**: Forms, modals, interactivity, browser APIs

### 3. Server Actions

```tsx
"use server"
export async function createOrg(formData: FormData): Promise<ActionResult<Organization>> {
  const client = await createClient();
  // ... validation and DB operations
  return { success: true, data: org };
}
```

**Used for**: Secure data mutations, form submissions, sensitive operations

### 4. Dynamic Routes (Next.js 15)

```tsx
export default async function Page({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params; // params is a Promise in Next.js 15
  // ... use id
}
```

### 5. TanStack Query Prefetching

```tsx
export default async function Page() {
  const queryClient = new QueryClient();
  
  // Prefetch server-side for instant hydration
  await queryClient.prefetchQuery({
    queryKey: ["organizations"],
    queryFn: () => getOrgs(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrganizationList />
    </HydrationBoundary>
  );
}
```

## Authentication Flow

1. User visits `/login`
2. Enters email → `login()` server action sends OTP
3. Clicks magic link → `/api/auth/callback` exchanges code for session
4. Redirected to `/dashboard/organizations`
5. Middleware refreshes session on all requests
6. Protected routes check auth and redirect to `/login` if needed

## Type Definitions

### ActionResult Pattern

All server actions return consistent error handling:

```typescript
// src/app/types/action.ts
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### Database Types

Core types in `src/app/types/supabase.ts`:

- `User` - Authenticated users
- `Organization` - Teams/organizations
- `OrganizationWithRole` - Org with user's role
- `OrganizationMember` - Team members with emails
- `Repo` - Code repositories with indexing status
- `Documentation` - Generated documentation per repo
- `DocPage` - Hierarchical documentation pages
- `Conversation` - Chat conversations per repo
- `ConversationMessage` - Individual chat messages
- `GitHubInstallation` - GitHub App installations
- `CodeSnippet` - Code blocks in messages

## Environment Variables

Required in `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_SECRET_KEY=your-service-role-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Backend
BACKEND_URL=http://localhost:8000

# GitHub App
NEXT_PUBLIC_GITHUB_APP_CLIENT_ID=your-app-id
GITHUB_APP_CLIENT_ID=your-oauth-client-id
GITHUB_APP_CLIENT_SECRET=your-oauth-secret
GITHUB_APP_PRIVATE_KEY_PATH=./github-app-private-key.pem
# OR
GITHUB_APP_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...

# GitLab OAuth
GITLAB_CLIENT_ID=your-gitlab-client-id
GITLAB_CLIENT_SECRET=your-gitlab-client-secret
GITLAB_REDIRECT_URI=http://localhost:3000/api/gitlab/installation
```

## Conventions

1. **Path Aliases**: All imports use `@/` prefix configured in `tsconfig.json`
2. **Server Actions**: Return `ActionResult<T>` for consistent error handling
3. **Query Keys**: Follow pattern `["entity"]` or `["entity", id]`
4. **File Naming**: `page.tsx` for routes, `layout.tsx` for layouts, `actions.ts` for server actions
5. **Params**: Always await params in Next.js 15 dynamic routes

## Key Files

- **layout.tsx**: Root layout with ThemeProvider + QueryProvider
- **page.tsx**: Landing page with authentication check
- **globals.css**: Tailwind CSS v4 with OKLch color variables
- **middleware.ts** (in `src/`): Session refresh and auth routing
- **types/supabase.ts**: Database schema types
- **types/action.ts**: Server action result type

## Related Documentation

- Components: `src/components/README.md`
- Services: `src/lib/README.md`
- Utilities: `src/utils/README.md`
- Hooks: `src/hooks/README.md`
