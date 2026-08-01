"use client";

import { useState, useEffect, useRef } from "react";
import { Menu, List, FileText, Loader2 } from "lucide-react";
import { FileTreeSidebar } from "./file-tree";
import { MainContent } from "./main-content";
import { TableOfContentsSidebar } from "./table-of-contents";
import { FileTreeSkeleton } from "./file-tree-skeleton";
import { MainContentSkeleton } from "./main-content-skeleton";
import { TableOfContentsSkeleton } from "./table-of-contents-skeleton";
import { Page, FileTreeNode, Heading } from "./types";
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
} from "@/lib/services/repoService";
import { motion } from "framer-motion";

export default function DocumentationViewer({ repoId }: { repoId: string }) {
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<Page | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isFileTreeOpen, setIsFileTreeOpen] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [error, setError] = useState("");
  const mainContentScrollRef = useRef<HTMLDivElement>(null);
  const setHasDocumentation = useChatUIStore(
    (state) => state.setHasDocumentation,
  );

  const selectedVersion = useDocumentationStore(
    (state) => state.selectedVersion,
  );
  const setAvailableVersions = useDocumentationStore(
    (state) => state.setAvailableVersions,
  );
  const selectVersion = useDocumentationStore((state) => state.selectVersion);
  const isIndexing = useDocumentationStore((state) => state.isIndexing);
  const setIsIndexing = useDocumentationStore((state) => state.setIsIndexing);
  const availableVersions = useDocumentationStore(
    (state) => state.availableVersions,
  );
  const setSelectedVersionInChat = useChatUIStore(
    (state) => state.setSelectedVersion,
  );

  /*This is a React anti-pattern. Replace with tanstack query later*/
  useEffect(() => {
    fetchVersions();
  }, []);

  useEffect(() => {
    if (selectedVersion !== null) {
      // Sync the selected version to the chat store
      setSelectedVersionInChat(selectedVersion);
      fetchDocumentation();
    }
  }, [selectedVersion, setSelectedVersionInChat]);

  useEffect(() => {
    if (selectedFile) {
      const extractedHeadings = extractHeadings(selectedFile.content);
      setHeadings(extractedHeadings);
    }
  }, [selectedFile]);

  const fetchVersions = async () => {
    try {
      // Check if repository is still indexing
      const repoResult = await getRepoWithStatus(repoId);

      if (!repoResult.success) {
        console.error("Error fetching repo status:", repoResult.error);
        return;
      }

      // Don't fetch documentation if still indexing
      if (repoResult.data.index_status === "indexing") {
        console.log("Repository is still indexing, skipping version fetch");
        setIsIndexing(true);
        setIsLoading(false);
        return;
      }

      // If we get here, indexing is complete
      setIsIndexing(false);

      const result = await getDocumentationVersions(repoId);

      if (!result.success) {
        console.error("Error fetching versions:", result.error);
        return;
      }

      // If no documentation versions exist, the repo has never been indexed
      if (result.data.length === 0) {
        console.log("No documentation versions found");
        setIsIndexing(false);
        setIsLoading(false);
        return;
      }

      const versions = result.data.map((doc) => ({
        version: doc.version ?? 0,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      }));

      setAvailableVersions(versions);

      // Auto-select the latest version
      if (versions.length > 0) {
        selectVersion(versions[0].version);
      }
    } catch (error) {
      console.error("Error fetching versions:", error);
    }
  };

  const fetchDocumentation = async () => {
    try {
      setIsLoading(true);

      if (selectedVersion === null) {
        setIsLoading(false);
        return;
      }

      const result = await getDocPagesForVersion(repoId, selectedVersion);

      if (!result.success) {
        console.error("Error fetching documentation:", result.error);
        setFileTree([]);
        setHasDocumentation(false);
        setIsLoading(false);
        return;
      }

      // Map DocPage[] to Page[]
      const pages: Page[] = result.data.map((docPage) => {
        // Helper function to parse JSON fields to string arrays
        const parseToStringArray = (field: unknown): string[] | null => {
          if (!field) return null;
          if (Array.isArray(field)) return field;
          if (typeof field === "string") {
            try {
              const parsed = JSON.parse(field);
              return Array.isArray(parsed) ? parsed : null;
            } catch {
              return null;
            }
          }
          return null;
        };

        return {
          id: docPage.id,
          documentation_id: docPage.documentation_id,
          title: docPage.title ?? "Untitled",
          slug: docPage.slug ?? "",
          content: docPage.content ?? "",
          order_index: docPage.order_index ?? 0,
          parent_page_id: docPage.parent_page_id,
          referenced_files: parseToStringArray(docPage.referenced_files),
          referenced_symbols: parseToStringArray(docPage.referenced_symbols),
          metadata: docPage.metadata,
          created_at: docPage.created_at,
          updated_at: docPage.updated_at ?? docPage.created_at,
          version: 1, // Default version for now
        };
      });

      const tree = buildFileTree(pages);
      setFileTree(tree);

      // Set the first page as selected if available
      if (pages.length > 0) {
        setSelectedFile(pages[0]);
      }

      // Update chat UI store with documentation availability
      setHasDocumentation(pages.length > 0);
    } catch (error) {
      setHasDocumentation(false);
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleRefresh = async () => {
    try {
      setError("");
      setIsIndexing(true);

      const result = await indexRepository(repoId);

      if (!result.success) {
        setError(result.error);
        setIsIndexing(false);
        return;
      }

      // Clear client-side documentation state
      setFileTree([]);
      setSelectedFile(null);
      setExpandedNodes(new Set());
      setHeadings([]);
      setHasDocumentation(false);

      setShowRefreshModal(false);
      // Keep isIndexing true - it will be cleared when fetchVersions detects completion

      // Refetch versions to include the new one
      await fetchVersions();
    } catch (e) {
      setError("Could not refresh: " + e);
      setIsIndexing(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setError("");
      setIsIndexing(true);

      const result = await indexRepository(repoId);

      if (!result.success) {
        setError(result.error);
        setIsIndexing(false);
        return;
      }

      setShowGenerateModal(false);
      // Keep isIndexing true - it will be cleared when fetchVersions detects completion

      // Refetch versions to include the new one
      await fetchVersions();
    } catch (e) {
      setError("Could not generate documentation: " + e);
      setIsIndexing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex bg-background h-full">
        <FileTreeSkeleton />
        <MainContentSkeleton />
        <TableOfContentsSkeleton />
      </div>
    );
  }

  if (isIndexing) {
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
          </div>
        </div>
      </div>
    );
  }

  if (fileTree.length === 0) {
    return (
      <>
        <div className="flex h-full items-center justify-center bg-background">
          <Empty
            title="No documentation available"
            description="Index your codebase to generate documentation and enable AI insights."
            icon={<FileText className="h-8 w-8" />}
          >
            <Button onClick={() => setShowGenerateModal(true)}>
              Index Codebase
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
            {error && (
              <div className="w-full p-3 bg-destructive/10 text-destructive text-sm rounded-md text-center">
                {error}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowGenerateModal(false)}
                className="w-full sm:w-auto"
                disabled={isIndexing}
              >
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={handleGenerate}
                disabled={isIndexing}
              >
                {isIndexing ? (
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
          availableVersions.find(
            (version) => version.version === selectedVersion,
          )?.updatedAt ?? ""
        }
        onSelectFile={setSelectedFile}
        onToggleExpanded={toggleExpanded}
        onSearchChange={setSearchQuery}
        isOpen={isFileTreeOpen}
        onClose={() => setIsFileTreeOpen(false)}
      />

      <MainContent
        selectedFile={selectedFile}
        scrollContainerRef={mainContentScrollRef}
      />

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
          {error && (
            <div className="w-full p-3 bg-destructive/10 text-destructive text-sm rounded-md text-center">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRefreshModal(false)}
              className="w-full sm:w-auto"
              disabled={isIndexing}
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleRefresh}
              disabled={isIndexing}
            >
              {isIndexing ? (
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
