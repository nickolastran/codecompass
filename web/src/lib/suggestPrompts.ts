import type { DocPage } from "@/app/types/supabase";

export const FALLBACK = [
  "Explain this codebase structure",
  "Where is the main entry point?",
  "How is data stored and accessed?",
  "What are the main dependencies?",
];

const CODE_FILE = /\.(tsx?|jsx?|mjs|py|go|rs|java|kt|cs|cpp|c|rb|php|swift)$/;

// Two prompts from doc page titles, two from code files those pages cite.
// One file per page so the picks spread across the codebase.
export function suggestPrompts(pages: DocPage[]): string[] {
  const titles = pages
    .map((p) => p.title)
    .filter((t): t is string => !!t && !/overview/i.test(t));

  const files: string[] = [];
  for (const p of pages) {
    const refs = (
      typeof p.referenced_files === "string"
        ? JSON.parse(p.referenced_files)
        : (p.referenced_files ?? [])
    ) as string[];
    const name = refs
      .map((f) => f.split("/").slice(-2).join("/")) // "sudoku/backdrop.tsx", not just "backdrop.tsx"
      .find((n) => CODE_FILE.test(n) && !files.includes(n));
    if (name) files.push(name);
  }

  const prompts = [
    ...titles.slice(0, 2).map((t) => `Walk me through ${t}`),
    files[0] && `What does ${files[0]} do?`,
    files[1] && `Where is ${files[1]} used?`,
  ].filter((p): p is string => !!p);

  return prompts.length === 4 ? prompts : FALLBACK;
}
