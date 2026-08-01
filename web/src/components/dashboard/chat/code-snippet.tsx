"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";

import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function CodeSnippet({
  file,
  code,
}: {
  file: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="bg-elevated rounded-sm">
      <Dialog>
        <div className="flex flex-row">
          <DialogTrigger asChild>
            <button className="font-sans text-xs pl-2 pt-1 hover:text-primary transition-colors cursor-pointer">
              {file}
            </button>
          </DialogTrigger>
        </div>
        <SyntaxHighlighter
          language="javascript"
          style={vscDarkPlus}
          showLineNumbers={true}
          customStyle={{
            background: "#1e1e1e",
            padding: "1rem",
            fontSize: "11px",
          }}
        >
          {code}
        </SyntaxHighlighter>

        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>{file}</DialogTitle>
                <DialogDescription>Full file content</DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <SyntaxHighlighter
              language="javascript"
              style={vscDarkPlus}
              showLineNumbers={true}
              customStyle={{
                background: "#1e1e1e",
                padding: "1rem",
                fontSize: "12px",
                margin: 0,
              }}
            >
              {code}
            </SyntaxHighlighter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
