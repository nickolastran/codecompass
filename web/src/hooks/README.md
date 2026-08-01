# Hooks Directory

This directory contains custom React hooks for CodeCompass, providing reusable logic for route prefetching, state management, and component functionality.

## Overview

The hooks directory includes:
- Custom hooks for route/data prefetching
- Zustand stores for client UI state
- React Context hooks for shared state

## Directory Structure

```
hooks/
└── usePrefetchRoute.ts          # Route + data prefetching hook
```

Additional state management hooks are located in `src/lib/stores/`:
```
lib/stores/
├── useChatUIStore.ts            # Chat interface state
├── useNavbarStore.ts            # Navigation state
├── useDocumentationStore.ts     # Documentation viewer state
└── useDashboardStore.ts         # Dashboard state (empty)
```

## Custom Hooks

### 1. usePrefetchRoute

**Location**: `src/hooks/usePrefetchRoute.ts`

**Purpose**: Combines Next.js route prefetching with React Query data prefetching for optimal navigation performance.

**Functions**:

```typescript
const {
  prefetchOrgPage,
  prefetchTeamPage,
  prefetchOrganizationsPage,
  prefetchRepoPage
} = usePrefetchRoute();
```

| Function | Purpose | Prefetches |
|----------|---------|------------|
| `prefetchOrgPage(orgId)` | Organization detail page | Route + repositories data |
| `prefetchTeamPage(orgId)` | Team management page | Route + organization members |
| `prefetchOrganizationsPage()` | Organizations list | Route only |
| `prefetchRepoPage(repoId)` | Repository page | Route (data prefetch TODO) |

**Usage Example**:

```tsx
"use client"
import { usePrefetchRoute } from "@/hooks/usePrefetchRoute";

export function OrganizationCard({ org }) {
  const { prefetchOrgPage } = usePrefetchRoute();

  return (
    <div onMouseEnter={() => prefetchOrgPage(org.id)}>
      <h3>{org.name}</h3>
    </div>
  );
}
```

**Key Features**:
- 2-minute stale time for prefetched data
- Automatic cache invalidation
- Parallel route + data prefetching

**Dependencies**:
- `next/navigation` - useRouter()
- `@tanstack/react-query` - useQueryClient()
- Services: `getOrgMembers()`, `getReposByOrganizationId()`

---

## Zustand Stores

All Zustand stores are located in `src/lib/stores/` and follow React Hook naming conventions.

### 2. useChatUIStore

**Location**: `src/lib/stores/useChatUIStore.ts`

**Purpose**: Manages chat interface UI state (expansion, model selection, conversations).

**State**:

```typescript
{
  isExpanded: boolean;
  initialMessage: string;
  selectedModel: LLMModel;
  conversation: Conversation | null;
  hasDocumentation: boolean;
  repoId: string | null;
  selectedVersion: number | null;
}
```

**Actions**:

| Action | Purpose |
|--------|---------|
| `expand(message)` | Open chat overlay with initial message |
| `minimize()` | Close chat overlay |
| `toggle()` | Toggle expanded state |
| `setSelectedModel(model)` | Change LLM model |
| `setConversation(conversation)` | Set active conversation |
| `startNewConversation()` | Reset for new chat |
| `setHasDocumentation(bool)` | Update docs availability |
| `setRepoId(repoId)` | Associate with repository |
| `setSelectedVersion(version)` | Set documentation version filter |
| `reset()` | Reset all state to defaults |

**Usage Example**:

```tsx
"use client"
import { useChatUIStore } from "@/lib/stores/useChatUIStore";

export function ChatBubble() {
  const isExpanded = useChatUIStore((state) => state.isExpanded);
  const expand = useChatUIStore((state) => state.expand);

  return (
    <button onClick={() => expand("How do I use this API?")}>
      {isExpanded ? "Minimize" : "Ask a question"}
    </button>
  );
}
```

**Used By**:
- `chat-bubble.tsx`
- `chat-overlay.tsx`
- `chat-interface.tsx`
- `message-bubble.tsx`
- `chat-input.tsx`
- `documentation.tsx`
- `version-selector.tsx`

---

### 3. useNavbarStore

**Location**: `src/lib/stores/useNavbarStore.ts`

**Purpose**: Manages navigation bar breadcrumbs and context text.

**State**:

```typescript
{
  contextText: string;
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
}
```

**Actions**:

| Action | Purpose |
|--------|---------|
| `setContext(text)` | Set page title/context |
| `setBreadcrumbs(breadcrumbs)` | Set breadcrumb array |
| `appendBreadcrumb(breadcrumb)` | Add single breadcrumb |
| `reset()` | Reset to "Dashboard" |

**Usage Example**:

```tsx
"use client"
import { useNavbarStore } from "@/lib/stores/useNavbarStore";

export function RepoPage({ repo, org }) {
  const setBreadcrumbs = useNavbarStore((state) => state.setBreadcrumbs);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Organizations", href: "/dashboard/organizations" },
      { label: org.name, href: `/dashboard/org/${org.id}` },
      { label: repo.name }
    ]);
  }, [repo, org]);

  return <div>...</div>;
}
```

**Used By**:
- `navcontext.tsx`
- `repo-context-setter.tsx`
- `organizations/members-table.tsx`
- `dashboard-sidebar.tsx`

---

### 4. useDocumentationStore

**Location**: `src/lib/stores/useDocumentationStore.ts`

**Purpose**: Manages documentation viewer state (versions, loading, indexing).

**State**:

```typescript
{
  selectedVersion: number | null;
  availableVersions: Array<{
    version: number;
    createdAt: string;
    updatedAt: string | null;
  }>;
  isLoading: boolean;
  isIndexing: boolean;
}
```

**Actions**:

| Action | Purpose |
|--------|---------|
| `selectVersion(version)` | Switch to documentation version |
| `setAvailableVersions(versions)` | Update available versions |
| `setIsLoading(loading)` | Set loading state |
| `setIsIndexing(indexing)` | Set indexing state |
| `reset()` | Reset all to defaults |

**Usage Example**:

```tsx
"use client"
import { useDocumentationStore } from "@/lib/stores/useDocumentationStore";

export function VersionSelector() {
  const selectedVersion = useDocumentationStore((state) => state.selectedVersion);
  const selectVersion = useDocumentationStore((state) => state.selectVersion);

  return (
    <select value={selectedVersion || ""} onChange={(e) => selectVersion(Number(e.target.value))}>
      <option value="">Latest</option>
      <option value="1">v1</option>
    </select>
  );
}
```

**Used By**:
- `documentation.tsx`
- `version-selector.tsx`

---

### 5. useDashboardStore

**Location**: `src/lib/stores/useDashboardStore.ts`

**Status**: Empty placeholder for future dashboard-wide UI state.

---

## Context Hooks

These hooks are defined within component files but provide context to child components.

### 6. useSidebar

**Location**: `src/components/dashboard/sidebar.tsx`

**Purpose**: Provides sidebar expansion state to child components.

**Context Type**:

```typescript
{
  isExpanded: boolean;
}
```

**Usage**:

```tsx
// Parent component
<Sidebar>
  <SidebarItem />
</Sidebar>

// Child component
function SidebarItem() {
  const { isExpanded } = useSidebar();
  return <div>{isExpanded && <Label />}</div>;
}
```

**Used By**:
- `SidebarItem`
- `SidebarDropdownItem`

---

### 7. useAuth

**Location**: `src/app/dashboard/dashboard-provider.tsx`

**Purpose**: Provides authenticated user data via React Context with React Query.

**Context Type**:

```typescript
{
  user: User | null;
  isLoading: boolean;
  error: Error | null;
}
```

**Usage**:

```tsx
// Must be within DashboardProvider
import { useAuth } from "@/app/dashboard/dashboard-provider";

export function UserProfile() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Skeleton />;
  return <div>Welcome, {user?.email}</div>;
}
```

**Key Features**:
- SSR hydration support with `initialUser`
- 5-minute stale time
- No auto-refetch on focus/mount
- Throws error if used outside DashboardProvider

---

## Hook Patterns

### 1. Zustand Selector Pattern (Recommended)

```tsx
// Good - Only re-renders when selectedModel changes
const selectedModel = useChatUIStore((state) => state.selectedModel);
const setModel = useChatUIStore((state) => state.setSelectedModel);
```

### 2. Zustand Destructuring (Less Optimal)

```tsx
// Works but re-renders on any state change
const { isExpanded, expand } = useChatUIStore();
```

### 3. Context Hook Pattern

```tsx
// Provider
export function MyProvider({ children }) {
  const value = { data, isLoading };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

// Hook
export function useMyContext() {
  const context = useContext(MyContext);
  if (!context) throw new Error("Must use within MyProvider");
  return context;
}
```

### 4. Client Component Declaration

All hooks require `"use client"` at the top of files:

```tsx
"use client"
import { useState } from "react";

export function useCustomHook() {
  // Hook logic
}
```

---

## State Management Strategy

| Type | Use Case | Location |
|------|----------|----------|
| **Zustand** | Client UI state (modals, sidebar, navigation) | `src/lib/stores/` |
| **React Query** | Server state (Supabase data, caching) | Via `useQuery()` in components |
| **React Context** | Shared component tree data | Component-level providers |
| **useState** | Local component state | Within components |

---

## Dependencies

| Hook | External Dependencies |
|------|----------------------|
| `usePrefetchRoute` | next/navigation, @tanstack/react-query |
| `useChatUIStore` | zustand |
| `useNavbarStore` | zustand |
| `useDocumentationStore` | zustand |
| `useSidebar` | react, motion/react |
| `useAuth` | react, @tanstack/react-query, @/utils/supabase/client |

---

## Type Definitions

```typescript
// LLM Model
interface LLMModel {
  id: string;
  name: string;
  provider: string;
}

// Conversation
interface Conversation {
  id: string;
  user_id: string;
  repo_id: string;
  title: string;
  repo_version: number | null;
  created_at: string;
  updated_at: string;
}

// Version Info
interface VersionInfo {
  version: number;
  createdAt: string;
  updatedAt: string | null;
}
```

---

## Best Practices

1. **Use Selector Pattern**: For Zustand stores, use selectors to prevent unnecessary re-renders
2. **Prefetch on Hover**: Use `usePrefetchRoute` on `onMouseEnter` for instant navigation
3. **Context Error Boundaries**: Always throw errors when context is undefined
4. **Minimal State**: Only store UI state in Zustand, use React Query for server data
5. **Reset on Unmount**: Call `reset()` when appropriate to clean up state

---

## Related Documentation

- Components: `src/components/README.md`
- Services: `src/lib/README.md`
- App Routes: `src/app/README.md`
- Utilities: `src/utils/README.md`
