# Utils Directory

This directory contains utility modules for Supabase client management and external service integrations.

## Overview

The utils directory provides:
- Supabase client utilities for browser, server, and middleware
- GitHub App integration utilities
- Session management and authentication routing

## Directory Structure

```
utils/
├── supabase/
│   ├── client.ts              # Browser Supabase client
│   ├── server.ts              # Server & Admin Supabase clients
│   └── middleware.ts          # Session refresh & route protection
└── github/
    └── app.ts                 # GitHub App OAuth & API
```

---

## Supabase Utilities (`/supabase`)

### Overview

CodeCompass uses **three different Supabase clients** for different contexts:

| Client | Context | RLS Policy | Usage |
|--------|---------|------------|-------|
| Browser | Client components | Respects | User-facing operations |
| Server | Server components/actions | Respects | Authenticated operations |
| Admin | Server-only | Bypasses | Privileged operations |

---

### client.ts - Browser Client

**Location**: `src/utils/supabase/client.ts`

**Purpose**: Creates Supabase client for client-side operations.

```typescript
import { createClient } from "@/utils/supabase/client";

export function ClientComponent() {
  const supabase = createClient();
  // Use for client-side queries, real-time subscriptions
}
```

**Implementation**:
```typescript
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

**Key Features**:
- Uses `@supabase/ssr` for proper cookie handling
- Safe to use in `"use client"` components
- Uses public/publishable keys (safe to expose)
- Respects Row-Level Security (RLS) policies

**When to Use**:
- Client components
- Real-time subscriptions
- Browser-side data fetching
- Client-side interactions

---

### server.ts - Server & Admin Clients

**Location**: `src/utils/supabase/server.ts`

#### Standard Server Client

**Purpose**: Creates Supabase client for server-side operations with cookie management.

```typescript
import { createClient } from "@/utils/supabase/server";

export async function ServerComponent() {
  const supabase = await createClient();
  // Use for server-side queries
}
```

**Implementation**:
```typescript
export async function createClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );
}
```

**Key Features**:
- Automatic session refresh via cookie management
- Respects RLS policies
- Uses Next.js 15 cookies API
- Safe for user-facing operations

**When to Use**:
- Server Components
- Server Actions
- API Routes
- Any server-side operation requiring user context

---

#### Admin Client

**Purpose**: Creates Supabase client with elevated permissions that bypasses RLS.

```typescript
import { createAdminClient } from "@/utils/supabase/server";

export async function privilegedOperation() {
  const supabase = createAdminClient();
  // Use with extreme caution - bypasses RLS
}
```

**Implementation**:
```typescript
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
```

**Key Features**:
- Uses service role key (secret)
- **Bypasses ALL RLS policies**
- No session persistence
- No auto-refresh

**When to Use** (ONLY):
- System-level operations
- Administrative tasks requiring elevated permissions
- Batch operations across users
- Operations that must bypass RLS

**Security Warning**:
- Never expose admin client to browser
- Never use for user-initiated operations
- Always validate permissions in your code
- Use sparingly and with caution

---

### middleware.ts - Session Management

**Location**: `src/utils/supabase/middleware.ts`

**Purpose**: Next.js middleware for automatic session refresh and route protection.

**Key Functions**:
1. **Session Refresh**: Automatically refreshes Supabase sessions on every request
2. **Route Protection**: Enforces authentication rules
3. **Cookie Management**: Maintains auth cookies across server boundary

**Implementation**:

```typescript
export async function updateSession(request: NextRequest) {
  const { supabase, response } = createServerClient(request);

  // CRITICAL: Must call getUser() before any logic
  const { data: { user } } = await supabase.auth.getUser();

  const publicPaths = ["/", "/login", "/auth", "/api/auth", "/error"];
  const isPublicPath = publicPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );

  // Redirect authenticated users away from login
  if (user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard/organizations", request.url));
  }

  // Redirect unauthenticated users to login
  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}
```

**Authentication Logic**:

```
Public paths: /, /login, /auth/*, /api/auth/*, /error

User authenticated + /login → Redirect to /dashboard/organizations
User unauthenticated + protected route → Redirect to /login
```

**Usage in `src/middleware.ts`**:

```typescript
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Critical Notes**:
- Must call `supabase.auth.getUser()` before any routing logic
- Cookie synchronization prevents random logouts
- Never modify cookies directly outside this pattern
- Runs on every request (except static assets)

---

## GitHub Integration (`/github`)

### app.ts - GitHub App Integration

**Location**: `src/utils/github/app.ts`

**Purpose**: Manage GitHub App OAuth and repository access through Octokit.

#### GitHub App Instance

```typescript
import { githubApp } from "@/utils/github/app";

export const githubApp = new App({
  appId: process.env.NEXT_PUBLIC_GITHUB_APP_CLIENT_ID!,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY || 
              readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH!, "utf-8"),
  oauth: {
    clientId: process.env.GITHUB_APP_CLIENT_ID!,
    clientSecret: process.env.GITHUB_APP_CLIENT_SECRET!,
  },
});
```

**Environment Variables**:
```bash
NEXT_PUBLIC_GITHUB_APP_CLIENT_ID=your-app-id       # Public
GITHUB_APP_CLIENT_ID=your-oauth-client-id          # Server-side
GITHUB_APP_CLIENT_SECRET=your-oauth-secret         # Server-side
GITHUB_APP_PRIVATE_KEY_PATH=./github-app.pem       # OR
GITHUB_APP_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...
```

---

#### Functions

##### getInstallationToken()

Generate installation access token (1-hour expiry).

```typescript
export async function getInstallationToken(
  installationId: number,
): Promise<string>
```

**Usage**:
```typescript
const token = await getInstallationToken(12345);
// Use token for GitHub API requests on behalf of installation
```

**Returns**: Installation access token string

---

##### getInstallationByAccount()

Find GitHub App installation for a user/organization.

```typescript
export async function getInstallationByAccount(
  accountLogin: string
): Promise<Installation | null>
```

**Usage**:
```typescript
const installation = await getInstallationByAccount("octocat");
if (installation) {
  console.log(installation.id);
}
```

**Returns**: Installation data or `null` if not found

---

##### checkRepoAccess()

Verify if installation has access to specific repository.

```typescript
export async function checkRepoAccess(
  installationId: number,
  owner: string,
  repo: string,
): Promise<boolean>
```

**Usage**:
```typescript
const hasAccess = await checkRepoAccess(12345, "vercel", "next.js");
if (hasAccess) {
  // Proceed with repo operations
}
```

**Returns**: Boolean indicating access status

---

#### Usage Context

**Used for**:
- GitHub OAuth flow in authentication
- Repository access validation before linking
- Managing repository permissions
- GitHub App installation webhooks

**Example Flow**:
1. User installs GitHub App
2. Callback receives `installation_id` and `code`
3. Exchange code for installation token
4. Verify repository access
5. Store installation in Supabase
6. Allow user to create repos from GitHub URLs

---

## Environment Variables

### Required Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGc...  # Publishable key
SUPABASE_SECRET_KEY=eyJhbGc...                   # Service role key (admin)

# GitHub App
NEXT_PUBLIC_GITHUB_APP_CLIENT_ID=123456          # App ID (public)
GITHUB_APP_CLIENT_ID=Iv1.abc123                  # OAuth client ID
GITHUB_APP_CLIENT_SECRET=abc123secret            # OAuth secret
GITHUB_APP_PRIVATE_KEY_PATH=./github-app.pem     # Path to private key
# OR
GITHUB_APP_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...  # Raw key
```

---

## Client Selection Guide

### Which Supabase Client Should I Use?

```
┌─────────────────────────────────────────────────────────────┐
│ Are you in a browser component ("use client")?             │
│ → YES: Use createClient() from client.ts                   │
│ → NO: Continue ↓                                            │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ Does this operation need to bypass RLS for system tasks?   │
│ → YES: Use createAdminClient() from server.ts (caution)    │
│ → NO: Use createClient() from server.ts                    │
└─────────────────────────────────────────────────────────────┘
```

### Examples

**Client Component**:
```tsx
"use client"
import { createClient } from "@/utils/supabase/client";

export function UserProfile() {
  const supabase = createClient();
  const { data } = await supabase.from("users").select();
  // Respects RLS, user can only see their own data
}
```

**Server Component/Action**:
```tsx
import { createClient } from "@/utils/supabase/server";

export async function getOrganizations() {
  "use server"
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select();
  // Respects RLS, user can only see their orgs
}
```

**Admin Operation**:
```tsx
import { createAdminClient } from "@/utils/supabase/server";

export async function migrateAllUsers() {
  "use server"
  const supabase = createAdminClient();
  const { data } = await supabase.from("users").select();
  // Bypasses RLS, returns ALL users (use with caution!)
}
```

---

## Best Practices

### Supabase Clients

1. **Always await server client**: `const supabase = await createClient()`
2. **Never expose admin client**: Only use server-side, never in browser
3. **Check authentication**: Always verify user before operations
4. **Let middleware handle cookies**: Don't manually manage auth cookies
5. **Use RLS when possible**: Prefer server client over admin client

### GitHub Integration

1. **Store installation tokens securely**: Never expose in browser
2. **Verify access before operations**: Check repo access with `checkRepoAccess()`
3. **Handle token expiration**: Installation tokens expire after 1 hour
4. **Use private key securely**: Never commit private key to version control

### Session Management

1. **Trust the middleware**: Don't duplicate auth checks
2. **Add paths to publicPaths**: For routes that don't require auth
3. **Never modify cookie logic**: Follow the established pattern
4. **Call getUser() first**: Required for proper session handling

---

## Security Considerations

1. **Environment Variables**:
   - Public keys (`NEXT_PUBLIC_*`): Safe to expose
   - Secret keys: Server-side only, never in browser

2. **RLS Policies**:
   - Browser client: Always respects RLS
   - Server client: Always respects RLS
   - Admin client: **Bypasses RLS** - extreme caution

3. **GitHub App**:
   - Private key: Never commit to git
   - Installation tokens: Server-side only
   - Webhooks: Verify signatures (TODO)

4. **Cookies**:
   - Let middleware handle all cookie management
   - Never manually set/delete auth cookies
   - Cookies are httpOnly and secure

---

## Related Documentation

- App Routes: `src/app/README.md`
- Services: `src/lib/README.md`
- Components: `src/components/README.md`
- Hooks: `src/hooks/README.md`
