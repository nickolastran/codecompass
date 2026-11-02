import type { Metadata } from "next";
import { cache } from "react";
import DocumentationViewer from "@/components/dashboard/documentation/documentation";
import ChatBubble from "@/components/dashboard/chat/chat-bubble";
import ChatOverlay from "@/components/dashboard/chat/chat-overlay";
import { NavbarContextSetter } from "@/components/dashboard/navbar-context-setter";
import { RepoContextSetter } from "@/components/dashboard/repo-context-setter";
import {
  getRepoWithStatus,
  getConversations,
  getLatestDocumentation,
} from "@/lib/services/repoService";
import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

// Dedupes the repo fetch between generateMetadata and the page
const getRepo = cache(getRepoWithStatus);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const repo = await getRepo(id);
  return { title: repo.success ? repo.data.name : "Repository" };
}

export default async function RepoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch repository details
  const repoResult = await getRepo(id);

  if (!repoResult.success) {
    console.error("Repository not found:", repoResult.error);
    notFound();
  }

  const repo = repoResult.data;

  // Fetch organization details for breadcrumbs
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", repo.organization_id)
    .single();

  // Fetch latest documentation version
  const latestDocResult = await getLatestDocumentation(id);
  const latestVersion = latestDocResult.success
    ? latestDocResult.data.version
    : null;

  // Prefetch conversations using TanStack Query
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["conversations", id, latestVersion],
    queryFn: async () => {
      const result = await getConversations(id, 20, latestVersion);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col h-full overflow-hidden">
        <NavbarContextSetter
          breadcrumbs={[
            { label: "Organizations", href: "/dashboard/organizations" },
            {
              label: org?.name || "Organization",
              href: `/dashboard/org/${repo.organization_id}`,
            },
            { label: repo.name },
          ]}
        />
        <RepoContextSetter repoId={repo.id} version={latestVersion} />
        {/* Documentation Viewer - Main content */}
        <div className="flex-1 overflow-hidden relative">
          <DocumentationViewer repoId={repo.id} />

          {/* Chat Bubble - Floating input (shows when chat is minimized) */}
          <ChatBubble />

          {/* Chat Overlay - Independent layer (shows when chat is expanded) */}
          <ChatOverlay />
        </div>
      </div>
    </HydrationBoundary>
  );
}
