import { ChevronRight } from "lucide-react";
import { toRepoPath } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { useEffect, useRef, useState } from "react";
import VersionSelector from "@/components/dashboard/chat/versionSelector";
import { MermaidDiagram } from "@/components/mermaidDiagram";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

interface MainContentProps {
  selectedFile: Page | null;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export function MainContent({
  selectedFile,
  scrollContainerRef: externalRef,
}: MainContentProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = externalRef || internalRef;
  const [isFilesDialogOpen, setIsFilesDialogOpen] = useState(false);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo(0, 0);
    }
  }, [selectedFile, scrollContainerRef]);

  if (!selectedFile) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="border-b border-grey-800 px-6 py-3"></div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-grey-500 text-sm">
            Select a file to view documentation
          </p>
        </div>
      </div>
    );
  }

  const generateHeadingId = (text: string) => {
    return text.toLowerCase().replace(/[^\w]+/g, "-");
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="h-14 shrink-0 border-b border-border px-6 flex items-center justify-between">
        <div className="flex flex-row gap-5 items-center">
          <h1 className="text-xl font-bold">{selectedFile.title}</h1>
          <VersionSelector />
        </div>
        <Dialog open={isFilesDialogOpen} onOpenChange={setIsFilesDialogOpen}>
          <DialogTrigger asChild>
            <motion.button
              className="text-xs h-8 px-4 border border-grey-700 rounded hover:bg-grey-800 transition-colors flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <span>Relevant source files</span>
              <motion.div
                animate={{ x: [0, 3, 0] }}
                transition={{
                  repeat: Infinity,
                  duration: 1.5,
                  ease: "easeInOut",
                }}
              >
                <ChevronRight className="w-3 h-3" />
              </motion.div>
            </motion.button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Referenced Source Files</DialogTitle>
              <DialogDescription>
                {selectedFile.referenced_files &&
                selectedFile.referenced_files.length > 0
                  ? `${selectedFile.referenced_files.length} file(s) referenced in this documentation`
                  : "No referenced files"}
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 min-w-0">
              {!selectedFile.referenced_files ||
              selectedFile.referenced_files.length === 0 ? (
                <p className="text-sm text-grey-400 text-center py-6">
                  No source files are referenced in this documentation page.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto min-w-0 pr-3 [scrollbar-width:thin] [scrollbar-gutter:stable]">
                  {selectedFile.referenced_files.map((file, index) => {
                    const rel = toRepoPath(file);
                    const slash = rel.lastIndexOf("/");
                    const dir = slash >= 0 ? rel.slice(0, slash + 1) : "";
                    const name = rel.slice(slash + 1);
                    return (
                      <li
                        key={index}
                        title={rel}
                        className="flex items-baseline gap-2 min-w-0 rounded-md border bg-muted/40 hover:bg-muted px-3 py-2 font-mono text-xs transition-colors"
                      >
                        <span className="shrink-0 text-teal-400">{name}</span>
                        <span className="truncate text-muted-foreground">
                          {dir}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto bg-grey-950"
      >
        <div className="max-w-full lg:max-w-4xl mx-4 md:mx-8 lg:ml-24 lg:mr-8 py-8 pb-135">
          <div className="markdown-content">
            <ReactMarkdown
              components={{
                h1: ({ node, children, ...props }) => {
                  const text = typeof children === "string" ? children : "";
                  const id = generateHeadingId(text);
                  return (
                    <h1
                      id={id}
                      className="text-3xl font-bold text-gray-800 dark:text-white mb-6 mt-2 scroll-mt-20"
                      {...props}
                    >
                      {children}
                    </h1>
                  );
                },
                h2: ({ node, children, ...props }) => {
                  const text = typeof children === "string" ? children : "";
                  const id = generateHeadingId(text);
                  return (
                    <h2
                      id={id}
                      className="text-2xl font-semibold text-gray-800 dark:text-white mb-4 mt-10 scroll-mt-20"
                      {...props}
                    >
                      {children}
                    </h2>
                  );
                },
                h3: ({ node, children, ...props }) => {
                  const text = typeof children === "string" ? children : "";
                  const id = generateHeadingId(text);
                  return (
                    <h3
                      id={id}
                      className="text-xl font-semibold text-gray-800 dark:text-white mb-3 mt-8 scroll-mt-20"
                      {...props}
                    >
                      {children}
                    </h3>
                  );
                },
                h4: ({ node, children, ...props }) => {
                  const text = typeof children === "string" ? children : "";
                  const id = generateHeadingId(text);
                  return (
                    <h4
                      id={id}
                      className="text-lg font-semibold text-gray-800 dark:text-white mb-3 mt-6 scroll-mt-20"
                      {...props}
                    >
                      {children}
                    </h4>
                  );
                },
                h5: ({ node, children, ...props }) => {
                  const text = typeof children === "string" ? children : "";
                  const id = generateHeadingId(text);
                  return (
                    <h5
                      id={id}
                      className="text-base font-semibold text-gray-800 dark:text-white mb-2 mt-4 scroll-mt-20"
                      {...props}
                    >
                      {children}
                    </h5>
                  );
                },
                h6: ({ node, children, ...props }) => {
                  const text = typeof children === "string" ? children : "";
                  const id = generateHeadingId(text);
                  return (
                    <h6
                      id={id}
                      className="text-sm font-semibold text-gray-800 dark:text-white mb-2 mt-4 scroll-mt-20"
                      {...props}
                    >
                      {children}
                    </h6>
                  );
                },
                p: ({ node, ...props }) => (
                  <p
                    className="text-grey-300 leading-relaxed mb-4"
                    {...props}
                  />
                ),
                ul: ({ node, ...props }) => (
                  <ul
                    className="list-disc list-inside text-grey-300 mb-4 space-y-2"
                    {...props}
                  />
                ),
                ol: ({ node, ...props }) => (
                  <ol
                    className="list-decimal list-inside text-grey-300 mb-4 space-y-2"
                    {...props}
                  />
                ),
                li: ({ node, ...props }) => (
                  <li className="text-grey-300" {...props} />
                ),
                a: ({ node, ...props }) => (
                  <a
                    className="text-teal-400 hover:text-teal-300 hover:underline"
                    {...props}
                  />
                ),
                code: ({ node, className, children, ...props }) => {
                  const isInline = !className?.includes("language-");
                  const match = /language-(\w+)/.exec(className || "");

                  if (match && match[1] === "mermaid") {
                    const code = String(children).replace(/\n$/, "");
                    return <MermaidDiagram chart={code} />;
                  }
                  return isInline ? (
                    <code
                      className="bg-grey-800 text-teal-400 px-1.5 py-0.5 rounded text-sm"
                      {...props}
                    >
                      {children}
                    </code>
                  ) : (
                    <code
                      className="block bg-grey-800 text-grey-300 p-4 rounded border border-grey-700 overflow-x-auto"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                blockquote: ({ node, ...props }) => (
                  <blockquote
                    className="border-l-4 border-teal-500 pl-4 italic text-grey-400 my-4"
                    {...props}
                  />
                ),
              }}
            >
              {selectedFile.content}
            </ReactMarkdown>
          </div>

          {selectedFile.referenced_files &&
            selectedFile.referenced_files.length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                  Referenced Files
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedFile.referenced_files.map((file, i) => (
                    <span
                      key={i}
                      className="rounded-md border bg-muted/40 px-2 py-1 text-xs text-teal-400 font-mono break-all"
                    >
                      {toRepoPath(file)}
                    </span>
                  ))}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
