import type { Metadata } from "next";
import { readFileSync } from "fs";
import { join } from "path";
import { MdxContent } from "@/components/docs/mdxContent";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Privacy() {
  const markdownContent = readFileSync(
    join(process.cwd(), "src/app/docs/privacy/PRIVACY.md"),
    "utf-8",
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <MdxContent content={markdownContent} />
    </div>
  );
}
