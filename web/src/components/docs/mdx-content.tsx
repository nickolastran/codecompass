"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useState } from "react";
import { DocsTableOfContents } from "./table-of-contents";

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface MdxContentProps {
  content: string;
}

export function MdxContent({ content }: MdxContentProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [isTocOpen, setIsTocOpen] = useState(false);

  // Extract headings from markdown content
  useEffect(() => {
    const extractedHeadings: Heading[] = [];
    const lines = content.split("\n");

    lines.forEach((line) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-");
        extractedHeadings.push({ id, text, level });
      }
    });

    setHeadings(extractedHeadings);
  }, [content]);

  return (
    <div className="flex gap-50 max-w-7xl mx-auto items-start">
      {/* Main content */}
      <article className="min-w-0 prose prose-slate dark:prose-invert max-w-none lg:max-w-3xl">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ node, children, ...props }) => {
              const text = typeof children === "string" ? children : "";
              const id = text
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-");
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
              const id = text
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-");
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
              const id = text
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-");
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
              const id = text
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-");
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
              const id = text
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-");
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
              const id = text
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-");
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
              <p className="text-grey-300 leading-relaxed mb-4" {...props} />
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
            table: ({ node, ...props }) => (
              <div className="overflow-x-auto my-6">
                <table
                  className="min-w-full border-collapse border border-grey-700"
                  {...props}
                />
              </div>
            ),
            thead: ({ node, ...props }) => (
              <thead className="bg-grey-800" {...props} />
            ),
            tbody: ({ node, ...props }) => (
              <tbody className="divide-y divide-grey-700" {...props} />
            ),
            tr: ({ node, ...props }) => (
              <tr className="border-b border-grey-700" {...props} />
            ),
            th: ({ node, ...props }) => (
              <th
                className="px-4 py-3 text-left text-sm font-semibold text-grey-200 border border-grey-700"
                {...props}
              />
            ),
            td: ({ node, ...props }) => (
              <td
                className="px-4 py-3 text-sm text-grey-300 border border-grey-700"
                {...props}
              />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </article>

      {/* Table of Contents */}
      <DocsTableOfContents
        headings={headings}
        isOpen={isTocOpen}
        onClose={() => setIsTocOpen(false)}
      />

      {/* Mobile TOC toggle button */}
      <button
        onClick={() => setIsTocOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 w-12 h-12 bg-teal-600 hover:bg-teal-700 rounded-full flex items-center justify-center shadow-lg z-30"
        title="Table of Contents"
      >
        <svg
          className="w-6 h-6 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
    </div>
  );
}
