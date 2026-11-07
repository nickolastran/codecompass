"use client";

import mermaid from "mermaid";
import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";

let renderCount = 0;

// Renders a "mermaid" code block. Until the source parses (still streaming, or the LLM
// wrote invalid syntax) it shows "fallback", so a broken diagram reads as code.
export function MermaidDiagram({
  chart,
  fallback,
}: {
  chart: string;
  fallback?: ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      mermaid.initialize({
        startOnLoad: false,
        theme: resolvedTheme === "light" ? "default" : "dark",
        // Diagrams are LLM output from repo content: no HTML labels or click handlers
        securityLevel: "strict",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      });
      // parse() first: a failed render() leaves error nodes in the page
      const valid = await mermaid.parse(chart, { suppressErrors: true });
      const result = valid
        ? (await mermaid.render(`mermaid-${renderCount++}`, chart)).svg
        : null;
      if (!cancelled) setSvg(result);
    })().catch(() => {
      if (!cancelled) setSvg(null);
    });

    return () => {
      cancelled = true;
    };
  }, [chart, resolvedTheme]);

  if (!svg) {
    return (
      fallback ?? (
        <code className="block whitespace-pre overflow-x-auto text-xs">
          {chart}
        </code>
      )
    );
  }

  return (
    <div
      className="my-6 flex justify-center items-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
