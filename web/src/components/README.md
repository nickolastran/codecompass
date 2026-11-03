# Components Directory

This directory contains all React components for CodeCompass, organized by feature and function.

## Overview

The components directory follows a **feature-based architecture** with clear separation between:
- Base UI components (shadcn/ui)
- Dashboard features (organizations, repos, docs, chat)
- Landing page marketing
- Public documentation site
- Root-level providers

## Directory Structure

```
components/
├── ui/                          # shadcn/ui base components
│   ├── button.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   ├── card.tsx
│   ├── table.tsx
│   └── ... (13 components)
├── dashboard/                   # Dashboard features
│   ├── organizations/           # Org management
│   ├── repos/                   # Repository management
│   ├── documentation/           # Documentation viewer
│   ├── chat/                    # AI chat interface
│   ├── gitlab/                  # GitLab integration
│   ├── navbar.tsx
│   └── sidebar.tsx
├── landing/                     # Landing page sections
│   ├── hero.tsx
│   ├── features.tsx
│   ├── comparison.tsx
│   └── navbar.tsx
├── docs/                        # Documentation site
│   ├── navbar.tsx
│   └── mdxContent.tsx
├── invite/                      # Invite flow
│   └── acceptInviteForm.tsx
├── queryProvider.tsx           # TanStack Query wrapper
└── themeProvider.tsx           # next-themes wrapper
```

## Component Categories

### 1. UI Components (`/ui`)

**Purpose**: Base shadcn/ui components with New York style + custom utilities

**Installed Components** (13):

| Component | Purpose | Variants/Features |
|-----------|---------|-------------------|
| `button.tsx` | Primary action button | default, destructive, outline, secondary, ghost, link |
| `input.tsx` | Text input field | Standard HTML input with styling |
| `select.tsx` | Dropdown select | Multi-option selection |
| `dialog.tsx` | Modal dialog | DialogTrigger, Content, Header, Footer |
| `label.tsx` | Form label | Accessible labels for inputs |
| `field.tsx` | Composite form field | FieldLabel, FieldError, FieldDescription |
| `card.tsx` | Container card | Card, CardHeader, CardContent, CardFooter |
| `separator.tsx` | Visual divider | Horizontal/vertical lines |
| `navigation-menu.tsx` | Navigation structure | Menu items with dropdowns |
| `dropdown-menu.tsx` | Context menu | Right-click or trigger menus |
| `table.tsx` | Data table | TableHeader, TableBody, TableRow, TableCell |
| `skeleton.tsx` | Loading placeholder | Pulse animation skeleton |
| `empty.tsx` | Empty state | Icon, title, description, optional CTA |

**Special Components**:
- `shadcn-io/grid-pattern/` - Animated grid background from shadcn.io

**Styling Features**:
- Uses `cn()` helper for conditional classes
- Tailwind CSS v4 with OKLch color space
- Dark mode support via `.dark` class
- Full accessibility (ARIA attributes, keyboard navigation)

**Adding New Components**:
```bash
npx shadcn@latest add [component-name]
```

---

### 2. Dashboard Components (`/dashboard`)

**Purpose**: Core authenticated user features

#### 2.1 Organizations (`/dashboard/organizations/`)

| Component | Type | Purpose |
|-----------|------|---------|
| `list.tsx` | Client | Grid of organization cards with TanStack Query |
| `card.tsx` | Client | Individual org card (clickable) |
| `newOrganizationForm.tsx` | Client | Form to create new org with validation |
| `membersTable.tsx` | Client | Table of org members with roles |
| `inviteMemberDialog.tsx` | Client | Modal to invite new team members |

**Key Features**:
- Query invalidation after mutations
- Server actions for data operations
- Role-based access control

#### 2.2 Repositories (`/dashboard/repos/`)

| Component | Type | Purpose |
|-----------|------|---------|
| `list.tsx` | Client | Grid of repository cards |
| `card.tsx` | Client | Repo card with provider icon + status |
| `newRepoForm.tsx` | Client | Create repo from GitHub/GitLab/local file |
| `orgHeader.tsx` | Client | Organization header with repo count |

**Key Features**:
- Provider detection (GitHub, GitLab, Local)
- Index status display (pending, processing, completed, failed)
- Motion animations on hover (framer-motion)
- File upload support (.zip, max 100MB)

#### 2.3 Documentation System (`/dashboard/documentation/`)

**Core Components**:

| Component | Type | Purpose |
|-----------|------|---------|
| `documentation.tsx` | Client | Main container managing doc state |
| `fileTree.tsx` | Client | Left sidebar with hierarchical navigation |
| `mainContent.tsx` | Client | Center panel with ReactMarkdown rendering |
| `tableOfContents.tsx` | Client | Right sidebar with heading navigation |
| `types.ts` | Types | Shared TypeScript interfaces |
| `utils.ts` | Utils | Tree building and heading extraction |

**Skeleton Loaders**:
- `fileTreeSkeleton.tsx`
- `mainContentSkeleton.tsx`
- `tableOfContentsSkeleton.tsx`

**TypeScript Interfaces**:
```typescript
interface Page {
  id: string;
  documentation_id: string;
  title: string;
  slug: string;
  content: string;
  order_index: number;
  parent_page_id: string | null;
  referenced_files: string[] | null;
  referenced_symbols: string[] | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string | null;
  version: number;
}

interface FileTreeNode extends Page {
  children: FileTreeNode[];
}

interface Heading {
  id: string;
  text: string;
  level: number;
}
```

**Key Features**:
- Hierarchical document navigation
- Version management
- Repository indexing workflow
- Mobile responsive (toggle buttons)
- Loading states with animations

#### 2.4 Chat System (`/dashboard/chat/`)

**Core Components**:

| Component | Type | Purpose |
|-----------|------|---------|
| `chatInterface.tsx` | Client | Main chat container with streaming |
| `messageList.tsx` | Client | One row per question: answer + its code snippets |
| `messageBubble.tsx` | Client | Individual message rendering |
| `chatInput.tsx` | Client | Message input with send button |
| `codeSnippet.tsx` | Client | Syntax-highlighted code in modal |

**Supporting Components**:
- `chatBubble.tsx` - Floating minimized chat input
- `chatOverlay.tsx` - Full-screen chat interface
- `chatEmptyState.tsx` - Welcome message for new conversations
- `versionSelector.tsx` - Documentation version filter
- `animatedSkeleton.tsx` - Streaming response loader

**Key Features**:
- Server-Sent Events (SSE) streaming
- Real-time code snippet extraction
- Markdown rendering with custom styles
- Syntax highlighting (react-syntax-highlighter with vscDarkPlus)
- Copy-to-clipboard functionality
- Zustand store integration for UI state

**Architecture Flow**:
```
ChatInterface
├── MessageList (row per question)
│   ├── MessageBubble (renders markdown + code)
│   └── CodeSnippet (snippets for that question)
└── ChatInput (user input)

ChatBubble (minimized) → ChatOverlay (expanded)
```

#### 2.5 Navigation (`/dashboard`)

| Component | Type | Purpose |
|-----------|------|---------|
| `navbar.tsx` | Client | Top navigation with breadcrumbs |
| `sidebar.tsx` | Client | Left navigation sidebar |
| `dashboardSidebar.tsx` | Client | Alternative sidebar implementation |
| `conversationPanel.tsx` | Client | Chat history panel |
| `navbarContextSetter.tsx` | Client | Sets breadcrumb context |
| `repoContextSetter.tsx` | Client | Sets repo context |
| `navcontext.tsx` | Context | Navigation context definitions |

**Key Features**:
- Context-aware breadcrumbs
- Sidebar collapse/expand with hover
- Mobile responsive drawer
- Active route highlighting

#### 2.6 GitLab Integration (`/dashboard/gitlab/`)

| Component | Type | Purpose |
|-----------|------|---------|
| `repoSelector.tsx` | Client | Select GitLab repos to import |

---

### 3. Landing Page Components (`/landing`)

**Purpose**: Public-facing marketing site

| Component | Type | Purpose |
|-----------|------|---------|
| `landingPage.tsx` | Client | Main container orchestrating all sections |
| `hero.tsx` | Client | Hero with animated heading + CTAs |
| `features.tsx` | Client | Feature highlights (dynamically imported) |
| `comparison.tsx` | Client | Feature comparison table (dynamically imported) |
| `cta.tsx` | Client | Call-to-action section |
| `onboardingCrisis.tsx` | Client | Problem statement section |
| `sectionContainer.tsx` | Server | Reusable section wrapper |
| `navbar.tsx` | Client | Landing page header |

**Key Features**:
- Framer Motion animations (fade-in, staggered)
- Responsive design (mobile-first)
- GridPattern background decoration
- Dynamic imports for code splitting
- Authentication-aware CTAs

---

### 4. Documentation Site (`/docs`)

| Component | Type | Purpose |
|-----------|------|---------|
| `navbar.tsx` | Client | Documentation site header |
| `mdxContent.tsx` | Client | MDX content renderer |
| `tableOfContents.tsx` | Client | Doc page table of contents |

---

### 5. Invite Flow (`/invite`)

| Component | Type | Purpose |
|-----------|------|---------|
| `acceptInviteForm.tsx` | Client | Accept organization invite form |

---

### 6. Root-Level Providers

| Component | Type | Purpose |
|-----------|------|---------|
| `queryProvider.tsx` | Client | TanStack Query initialization |
| `themeProvider.tsx` | Client | next-themes for light/dark mode |

---

## Component Patterns

### 1. Server vs. Client Components

**Server Components** (default):
```tsx
// No "use client" directive
export default function ServerComponent() {
  return <div>Static content</div>;
}
```

**Client Components** (for interactivity):
```tsx
"use client"
export function ClientComponent() {
  const [state, setState] = useState();
  return <button onClick={() => {}}>Interactive</button>;
}
```

### 2. TanStack Query Integration

```tsx
"use client"
export function OrganizationList() {
  const { data, isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => getOrgs(),
  });

  if (isLoading) return <Skeleton />;
  return <div>{data?.map(org => <Card key={org.id} />)}</div>;
}
```

### 3. Zustand Store Usage

```tsx
"use client"
export function ChatBubble() {
  const isExpanded = useChatUIStore((state) => state.isExpanded);
  const expand = useChatUIStore((state) => state.expand);

  return (
    <button onClick={() => expand("Hello!")}>
      {isExpanded ? "Minimize" : "Expand"}
    </button>
  );
}
```

### 4. Form Handling with Server Actions

```tsx
"use client"
export function NewOrganizationForm() {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    const result = await createOrg(formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(`/dashboard/org/${result.data.id}`);
  }

  return (
    <form action={handleSubmit}>
      <Input name="name" />
      {error && <FieldError>{error}</FieldError>}
      <Button type="submit">Create</Button>
    </form>
  );
}
```

### 5. Loading States

```tsx
export function ComponentWithLoading() {
  const { data, isLoading } = useQuery({ ... });

  if (isLoading) return <ComponentSkeleton />;
  if (!data) return <Empty title="No data" />;
  return <DataDisplay data={data} />;
}
```

## Styling Conventions

### 1. Tailwind Classes

Use semantic tokens and conditional classes:

```tsx
<div className={cn(
  "bg-background text-foreground",
  "border border-border rounded-lg",
  "p-4 sm:p-6",
  "dark:bg-gray-900",
  isActive && "ring-2 ring-primary"
)} />
```

### 2. Color System

Defined in `src/app/globals.css`:
- Light mode: `:root`
- Dark mode: `.dark` class
- Uses OKLch color space

### 3. Responsive Design

```tsx
<div className="
  grid grid-cols-1        // Mobile
  sm:grid-cols-2          // Tablet
  lg:grid-cols-3          // Desktop
  gap-4
" />
```

## Naming Conventions

1. **File Naming**: `component-name.tsx` (kebab-case)
2. **Component Naming**: `PascalCase` for exports
3. **Types**: `types.ts` alongside components
4. **Utils**: `utils.ts` for feature-specific helpers

## State Management

- **TanStack Query**: Server state (Supabase data)
- **Zustand**: Client UI state (chat expansion, navbar context, etc.)
- **React Context**: Authentication, sidebar state
- **useState**: Local component state

## Related Documentation

- App Routes: `src/app/README.md`
- Services: `src/lib/README.md`
- Hooks: `src/hooks/README.md`
- Utilities: `src/utils/README.md`
