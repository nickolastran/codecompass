"use client";

import { ArrowLeft, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatUIStore } from "@/lib/stores/useChatUIStore";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MessageBubbleProps {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: string;
}

export default function MessageBubble({ text, sender }: MessageBubbleProps) {
  const { minimize } = useChatUIStore();

  if (sender === "user") {
    return (
      <div className="mb-8 flex flex-row gap-6 px-5">
        <div className="text-gray-700 dark:text-gray-300 tracking-wide text-2xl leading-relaxed">
          {text}
        </div>

        <Button variant="ghost" onClick={minimize} aria-label="Close chat">
          <ArrowLeft className="h-5 w-5" />
          Back to documentation
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="mt-6">
        <div className="bg-elevated rounded-lg border border-gray-800 p-6">
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ node, ...props }) => (
                  <h1
                    className="text-2xl font-bold text-gray-800 dark:text-white mb-4 mt-2"
                    {...props}
                  />
                ),
                h2: ({ node, ...props }) => (
                  <h2
                    className="text-xl font-semibold text-gray-800 dark:text-white mb-3 mt-6"
                    {...props}
                  />
                ),
                h3: ({ node, ...props }) => (
                  <h3
                    className="text-lg font-semibold text-gray-800 dark:text-white mb-2 mt-4"
                    {...props}
                  />
                ),
                h4: ({ node, ...props }) => (
                  <h4
                    className="text-base font-semibold text-gray-800 dark:text-white mb-2 mt-3"
                    {...props}
                  />
                ),
                h5: ({ node, ...props }) => (
                  <h5
                    className="text-sm font-semibold text-gray-800 dark:text-white mb-1 mt-2"
                    {...props}
                  />
                ),
                h6: ({ node, ...props }) => (
                  <h6
                    className="text-xs font-semibold text-gray-800 dark:text-white mb-1 mt-2"
                    {...props}
                  />
                ),
                p: ({ node, ...props }) => (
                  <p
                    className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4"
                    {...props}
                  />
                ),
                ul: ({ node, ...props }) => (
                  <ul
                    className="list-disc list-inside text-gray-700 dark:text-gray-300 mb-4 space-y-1"
                    {...props}
                  />
                ),
                ol: ({ node, ...props }) => (
                  <ol
                    className="list-decimal list-inside text-gray-700 dark:text-gray-300 mb-4 space-y-1"
                    {...props}
                  />
                ),
                li: ({ node, ...props }) => (
                  <li className="text-gray-700 dark:text-gray-300" {...props} />
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
                  const language = match ? match[1] : "text";

                  return isInline ? (
                    <code
                      className="bg-gray-800 text-teal-400 px-1.5 py-0.5 rounded text-sm font-mono"
                      {...props}
                    >
                      {children}
                    </code>
                  ) : (
                    <SyntaxHighlighter
                      language={language}
                      style={vscDarkPlus}
                      showLineNumbers={true}
                      customStyle={{
                        background: "#1e1e1e",
                        padding: "1rem",
                        fontSize: "12px",
                        borderRadius: "0.375rem",
                        marginBottom: "1rem",
                      }}
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  );
                },
                blockquote: ({ node, ...props }) => (
                  <blockquote
                    className="border-l-4 border-teal-500 pl-4 italic text-gray-400 my-4"
                    {...props}
                  />
                ),
                pre: ({ node, ...props }) => (
                  <pre className="mb-4" {...props} />
                ),
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-800">
            <button className="p-2 hover:bg-gray-800 rounded-md transition-colors">
              <Copy size={16} className="text-gray-400" />
            </button>
            <button className="p-2 hover:bg-gray-800 rounded-md transition-colors">
              <Share2 size={16} className="text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
