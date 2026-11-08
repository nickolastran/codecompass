"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Menu, List, FileText, Loader2 } from "lucide-react";
import { FileTreeSidebar } from "./fileTree";
import { MainContent } from "./mainContent";
import { TableOfContentsSidebar } from "./tableOfContents";
import { FileTreeSkeleton } from "./fileTreeSkeleton";
import { MainContentSkeleton } from "./mainContentSkeleton";
import { TableOfContentsSkeleton } from "./tableOfContentsSkeleton";
import { EmptyStateSkeleton } from "./emptyStateSkeleton";
import { Page } from "./types";
import { buildFileTree, extractHeadings } from "./utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Empty } from "@/components/ui/empty";
import { useChatUIStore } from "@/lib/stores/useChatUIStore";
import { useDocumentationStore } from "@/lib/stores/useDocumentationStore";
import {
  indexRepository,
  getDocumentationVersions,
  getDocPagesForVersion,
  getRepoWithStatus,
  cancelIndexing,
} from "@/lib/services/repoService";
import { ActionResult } from "@/app/types/action";
import { DocPage } from "@/app/types/supabase";
import { motion } from "framer-motion";

async function unwrap<T>(promise: Promise<ActionResult<T>>): Promise<T> {
  const result = await promise;
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// pages.referenced_* are jsonb; older rows stored them as JSON strings
function toStringArray(field: unknown): string[] | null {
  if (Array.isArray(field)) return field;
  if (typeof field !== "string") return null;
  try {
    const parsed = JSON.parse(field);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toPage(docPage: DocPage): Page {
  return {
    id: docPage.id,
    documentation_id: docPage.documentation_id,
    title: docPage.title ?? "Untitled",
    slug: docPage.slug ?? "",
    content: docPage.content ?? "",
    order_index: docPage.order_index ?? 0,
    parent_page_id: docPage.parent_page_id,
    referenced_files: toStringArray(docPage.referenced_files),
    referenced_symbols: toStringArray(docPage.referenced_symbols),
    metadata: docPage.metadata,
    created_at: docPage.created_at,
    updated_at: docPage.updated_at ?? docPage.created_at,
    version: 1, // Default version for now
  };
}

export default function DocumentationViewer({
  repoId,
  hasDocs,
}: {
  repoId: string;
  hasDocs: boolean;
}) {
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isFileTreeOpen, setIsFileTreeOpen] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const mainContentScrollRef = useRef<HTMLDivElement>(null);
  const setHasDocumentation = useChatUIStore(
    (state) => state.setHasDocumentation,
  );
  const setSelectedVersionInChat = useChatUIStore(
    (state) => state.setSelectedVersion,
  );
  const selectedVersion = useDocumentationStore(
    (state) => state.selectedVersion,
  );
  const selectVersion = useDocumentationStore((state) => state.selectVersion);
  const setAvailableVersions = useDocumentationStore(
    (state) => state.setAvailableVersions,
  );
  const resetDocumentationStore = useDocumentationStore((state) => state.reset);

  // The repo's index_status is the source of truth for which screen shows.
  // Versions are only read once indexing is over; poll until then.
  const statusQuery = useQuery({
    queryKey: ["documentation-status", repoId],
    queryFn: async () => {
      const repo = await unwrap(getRepoWithStatus(repoId));
      const versions =
        repo.index_status === "indexing"
          ? []
          : (await unwrap(getDocumentationVersions(repoId))).map((doc) => ({
              version: doc.version ?? 0,
              createdAt: doc.created_at,
              updatedAt: doc.updated_at,
            }));
      return { repo, versions };
    },
    staleTime: 0,
    refetchInterval: (q) =>
      q.state.data?.repo.index_status === "indexing" ? 5000 : false,
  });
  const repo = statusQuery.data?.repo;
  const versions = statusQuery.data?.versions;

  // A version's pages never change once written
  const pagesQuery = useQuery({
    queryKey: ["documentation-pages", repoId, selectedVersion],
    queryFn: async () =>
      (await unwrap(getDocPagesForVersion(repoId, selectedVersion!))).map(
        toPage,
      ),
    enabled: versions?.some((v) => v.version === selectedVersion) ?? false,
    staleTime: Infinity,
  });
  const pages = pagesQuery.data;

  const startIndexing = useMutation({
    mutationFn: () => unwrap(indexRepository(repoId)),
    // Returned promise keeps the mutation pending until the status shows "indexing"
    onSuccess: async () => {
      await statusQuery.refetch();
      setShowRefreshModal(false);
      setShowGenerateModal(false);
    },
  });

  type View = "loading" | "error" | "indexing" | "empty" | "ready";
  const view: View =
    statusQuery.isError || pagesQuery.isError
      ? "error"
      : !repo
        ? "loading"
        : repo.index_status === "indexing"
          ? "indexing"
          : versions!.length === 0
            ? "empty"
            : !pages
              ? "loading"
              : pages.length === 0
                ? "empty"
                : "ready";

  const indexError =
    repo?.index_status === "failed"
      ? repo.metadata?.index_error || "Indexing failed."
      : "";
  const indexProgress = repo?.metadata?.index_progress ?? "";

  const fileTree = useMemo(() => buildFileTree(pages ?? []), [pages]);
  const selectedFile =
    pages?.find((page) => page.id === selectedPageId) ?? pages?.[0] ?? null;
  const headings = useMemo(
    () => (selectedFile ? extractHeadings(selectedFile.content) : []),
    [selectedFile],
  );

  // Show the newest version whenever the version list changes (first load, finished reindex)
  useEffect(() => {
    if (!versions) return;
    setAvailableVersions(versions);
    if (versions.length > 0) selectVersion(versions[0].version);
  }, [versions, setAvailableVersions, selectVersion]);

  // Version picks are per repo; don't carry them to the next one
  useEffect(() => resetDocumentationStore, [resetDocumentationStore]);

  useEffect(() => {
    if (selectedVersion !== null) setSelectedVersionInChat(selectedVersion);
  }, [selectedVersion, setSelectedVersionInChat]);

  useEffect(() => {
    setHasDocumentation(view === "ready");
  }, [view, setHasDocumentation]);

  const toggleExpanded = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const startError = startIndexing.error?.message ?? "";
  const isStarting = startIndexing.isPending;

  if (view === "error") {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Empty
          title="Could not load documentation"
          description={(statusQuery.error ?? pagesQuery.error)?.message}
          icon={<FileText className="h-8 w-8" />}
        >
          <Button
            onClick={() => {
              statusQuery.refetch();
              if (pagesQuery.isError) pagesQuery.refetch();
            }}
          >
            Try Again
          </Button>
        </Empty>
      </div>
    );
  }

  if (view === "loading") {
    if (!hasDocs) return <EmptyStateSkeleton />;
    return (
      <div className="flex bg-background h-full">
        <FileTreeSkeleton />
        <MainContentSkeleton />
        <TableOfContentsSkeleton />
      </div>
    );
  }

  if (view === "indexing") {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            <Loader2 className="h-12 w-12 text-primary" />
          </motion.div>
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Indexing Repository</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Your codebase is being indexed. This may take a while depending on
              the size of your repository. You can safely navigate away from
              this page.
            </p>
            {indexProgress && (
              <p className="text-sm font-medium mt-3 tabular-nums">
                {indexProgress}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await cancelIndexing(repoId);
              await statusQuery.refetch();
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (view === "empty") {
    return (
      <>
        <div className="flex h-full items-center justify-center bg-background">
          <Empty
            title={indexError ? "Indexing failed" : "No documentation available"}
            description={
              indexError
                ? "Something went wrong while indexing this repository."
                : "Index your codebase to generate documentation and enable AI insights."
            }
            icon={<FileText className="h-8 w-8" />}
          >
            {indexError && (
              <div className="w-full max-w-md mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md text-center break-words">
                {indexError}
              </div>
            )}
            <Button onClick={() => setShowGenerateModal(true)}>
              {indexError ? "Try Again" : "Index Codebase"}
            </Button>
          </Empty>
        </div>

        <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Index Codebase</DialogTitle>
              <DialogDescription>
                This will index your codebase. This process may take a while
                depending on the size of your repository.
              </DialogDescription>
            </DialogHeader>
            {startError && (
              <div className="w-full p-3 bg-destructive/10 text-destructive text-sm rounded-md text-center">
                {startError}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowGenerateModal(false)}
                className="w-full sm:w-auto"
                disabled={isStarting}
              >
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={() => startIndexing.mutate()}
                disabled={isStarting}
              >
                {isStarting ? (
                  <div className="flex items-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="mr-2"
                    >
                      <Loader2 className="h-4 w-4" />
                    </motion.div>
                    Indexing...
                  </div>
                ) : (
                  "Index"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="flex bg-background h-full">
      {/* Mobile toggle buttons */}
      <div className="fixed bottom-20 left-4 z-30 flex flex-col gap-2 lg:hidden">
        <Button
          size="icon"
          variant="default"
          onClick={() => setIsFileTreeOpen(true)}
          className="shadow-lg"
          aria-label="Open file tree"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <div className="fixed bottom-20 right-4 z-30 flex flex-col gap-2 xl:hidden">
        <Button
          size="icon"
          variant="default"
          onClick={() => setIsTocOpen(true)}
          className="shadow-lg"
          aria-label="Open table of contents"
        >
          <List className="h-5 w-5" />
        </Button>
      </div>

      <FileTreeSidebar
        fileTree={fileTree}
        selectedFile={selectedFile}
        expandedNodes={expandedNodes}
        searchQuery={searchQuery}
        lastIndexed={
          versions?.find(
            (version) => version.version === selectedVersion,
          )?.updatedAt ?? ""
        }
        onSelectFile={(page) => setSelectedPageId(page.id)}
        onToggleExpanded={toggleExpanded}
        onSearchChange={setSearchQuery}
        isOpen={isFileTreeOpen}
        onClose={() => setIsFileTreeOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* A failed reindex leaves the previous version in place; say so instead of failing silently */}
        {indexError && (
          <div
            role="alert"
            className="shrink-0 flex items-center gap-3 border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-sm text-destructive"
          >
            <span className="flex-1 min-w-0 line-clamp-2" title={indexError}>
              Last reindex failed, showing the previous version: {indexError}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRefreshModal(true)}
            >
              Retry
            </Button>
          </div>
        )}
        <MainContent
          selectedFile={selectedFile}
          scrollContainerRef={mainContentScrollRef}
        />
      </div>

      <TableOfContentsSidebar
        selectedFile={selectedFile}
        headings={headings}
        onRefreshClick={() => setShowRefreshModal(true)}
        isOpen={isTocOpen}
        onClose={() => setIsTocOpen(false)}
        scrollContainerRef={mainContentScrollRef}
      />

      <Dialog open={showRefreshModal} onOpenChange={setShowRefreshModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refresh this wiki</DialogTitle>
            <DialogDescription>
              This action will reindex your codebase and create a new version.
              The process may take a while depending on the size of your
              repository.
            </DialogDescription>
          </DialogHeader>
          {startError && (
            <div className="w-full p-3 bg-destructive/10 text-destructive text-sm rounded-md text-center">
              {startError}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRefreshModal(false)}
              className="w-full sm:w-auto"
              disabled={isStarting}
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={() => startIndexing.mutate()}
              disabled={isStarting}
            >
              {isStarting ? (
                <div className="flex items-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="mr-2"
                  >
                    <Loader2 className="h-4 w-4" />
                  </motion.div>
                  Reindexing...
                </div>
              ) : (
                "Refresh"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
