import { ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import VersionSelector from "@/components/dashboard/chat/version-selector";
import mermaid from "mermaid";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Initialize Mermaid once (outside component to avoid re-initialization)
let mermaidInitialized = false;
const initializeMermaid = (theme: string) => {
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === "dark" ? "dark" : "default",
    securityLevel: "loose",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
  });
  mermaidInitialized = true;
};

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

interface MermaidComponentProps {
  chart: string;
}

function MermaidComponent({ chart }: MermaidComponentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by waiting for client-side mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !ref.current) return;

    const currentTheme = resolvedTheme || theme || "dark";

    // Re-initialize Mermaid when theme changes
    if (!mermaidInitialized || ref.current.dataset.theme !== currentTheme) {
      initializeMermaid(currentTheme);
    }

    const renderDiagram = async () => {
      if (!ref.current) return;

      try {
        // Clear previous content
        ref.current.innerHTML = "";
        setError(null);

        // Generate unique ID for each diagram
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

        // Render the diagram
        const { svg } = await mermaid.render(id, chart);

        if (ref.current) {
          ref.current.innerHTML = svg;
          ref.current.dataset.theme = currentTheme;
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to render diagram";
        console.error("Mermaid rendering error:", err);
        setError(errorMessage);
      }
    };

    renderDiagram();
  }, [chart, theme, resolvedTheme, mounted]);

  if (!mounted) {
    return (
      <div className="my-6 flex justify-center items-center min-h-[200px] bg-grey-900 rounded border border-grey-800">
        <p className="text-grey-500 text-sm">Loading diagram...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-6 bg-red-900/20 border border-red-800 rounded p-4">
        <p className="text-red-400 text-sm font-semibold mb-1">
          Diagram rendering failed
        </p>
        <p className="text-red-300/80 text-xs">{error}</p>
        <details className="mt-2">
          <summary className="text-xs text-red-300/60 cursor-pointer hover:text-red-300/80">
            View source
          </summary>
          <pre className="mt-2 text-xs text-red-200/60 overflow-x-auto bg-red-950/30 p-2 rounded">
            {chart}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="mermaid my-6 flex justify-center items-center overflow-x-auto"
    />
  );
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
      <div className="border-b border-grey-800 px-6 py-3 flex items-center justify-between">
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

          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Referenced Source Files</DialogTitle>
              <DialogDescription>
                {selectedFile.referenced_files &&
                selectedFile.referenced_files.length > 0
                  ? `${selectedFile.referenced_files.length} file(s) referenced in this documentation`
                  : "No referenced files"}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {!selectedFile.referenced_files ||
              selectedFile.referenced_files.length === 0 ? (
                <p className="text-sm text-grey-400 text-center py-6">
                  No source files are referenced in this documentation page.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {selectedFile.referenced_files.map((file, index) => (
                    <div
                      key={index}
                      className="bg-grey-800 hover:bg-grey-700 rounded px-3 py-2 text-xs text-teal-400 transition-colors font-mono break-words"
                    >
                      {file}
                    </div>
                  ))}
                </div>
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
                    return <MermaidComponent chart={code} />;
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
              <div className="mt-6 pt-4 border-t border-grey-800">
                <h3 className="text-xs font-semibold text-grey-400 mb-2">
                  Referenced Files
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedFile.referenced_files.map((file, i) => (
                    <button
                      key={i}
                      className="bg-grey-800 hover:bg-grey-700 rounded px-2 py-1 text-xs text-teal-400 transition-colors font-mono"
                    >
                      {file}
                    </button>
                  ))}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
