import { JSX } from "react";
import { Search, ChevronRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatRelativeTime } from "@/lib/utils";

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
  metadata: JSON | null;
  created_at: string;
  updated_at: string;
  version: number;
}

interface FileTreeNode extends Page {
  children: FileTreeNode[];
}

interface FileTreeSidebarProps {
  fileTree: FileTreeNode[];
  selectedFile: Page | null;
  expandedNodes: Set<string>;
  searchQuery: string;
  lastIndexed: string;
  onSelectFile: (file: Page) => void;
  onToggleExpanded: (nodeId: string) => void;
  onSearchChange: (query: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function FileTreeSidebar({
  fileTree,
  selectedFile,
  expandedNodes,
  searchQuery,
  lastIndexed,
  onSelectFile,
  onToggleExpanded,
  onSearchChange,
  isOpen = false,
  onClose,
}: FileTreeSidebarProps) {
  const filterNodes = (
    nodes: FileTreeNode[],
    query: string,
  ): FileTreeNode[] => {
    if (!query) return nodes;

    const lowerQuery = query.toLowerCase();
    const filtered: FileTreeNode[] = [];

    nodes.forEach((node) => {
      const matchesSearch = node.title.toLowerCase().includes(lowerQuery);
      const filteredChildren = filterNodes(node.children, query);

      if (matchesSearch || filteredChildren.length > 0) {
        filtered.push({
          ...node,
          children: filteredChildren,
        });
      }
    });

    return filtered;
  };

  const filteredTree = filterNodes(fileTree, searchQuery);

  const renderFileTree = (
    nodes: FileTreeNode[],
    level: number = 0,
  ): JSX.Element[] => {
    return nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const isExpanded = searchQuery ? true : expandedNodes.has(node.id);
      const isSelected = selectedFile?.id === node.id;

      return (
        <div key={node.id}>
          <button
            onClick={() => {
              handleSelectFile(node);
              if (hasChildren) {
                onToggleExpanded(node.id);
              }
            }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm transition-colors rounded ${
              isSelected
                ? "bg-elevated dark:text-white"
                : "text-gray-400 hover:bg-elevated/50 dark:hover:text-gray-300"
            }`}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
          >
            {hasChildren ? (
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="w-3 h-3 shrink-0" />
              </motion.div>
            ) : (
              <div className="w-3" />
            )}
            <span className="truncate text-xs">{node.title}</span>
          </button>
          {hasChildren && (
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="pt-1">
                    {renderFileTree(node.children, level + 1)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      );
    });
  };

  const handleSelectFile = (file: Page) => {
    onSelectFile(file);
    // Close mobile drawer after selection
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        w-64 border-r border-border flex flex-col bg-background h-full
        lg:relative lg:translate-x-0
        ${isOpen ? "fixed inset-y-0 left-0 z-50 translate-x-0" : "hidden lg:flex"}
      `}
      >
        {/* Mobile close button */}
        {onClose && (
          <div className="lg:hidden p-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold">Documentation</span>
            <button onClick={onClose} className="p-1 hover:bg-elevated rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="p-3 border-b border-border">
          <div className="text-xs text-gray-500 mb-2">
            Last indexed: {formatRelativeTime(lastIndexed)}
          </div>
        </div>

        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search..."
              className="w-full bg-white dark:bg-gray-900 border border-border rounded pl-7 pr-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredTree.length > 0 ? (
            renderFileTree(filteredTree).map((element, index) => {
              // Clone element and update onSelectFile handler
              return <div key={index}>{element}</div>;
            })
          ) : (
            <div className="text-xs text-gray-500 p-2">No results found</div>
          )}
        </div>
      </div>
    </>
  );
}
