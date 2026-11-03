import type { Metadata } from "next";
import { readFileSync } from "fs";
import { join } from "path";
import { MdxContent } from "@/components/docs/mdxContent";

export const metadata: Metadata = { title: "Self-Hosting" };

export default function SelfHosting() {
  const markdownPath = join(
    process.cwd(),
    "src/app/docs/self-hosting/SELF_HOSTING.md",
  );
  const markdownContent = readFileSync(markdownPath, "utf-8");

  return (
    <div className="container mx-auto px-4 py-8">
      <MdxContent content={markdownContent} />
    </div>
  );
}
