import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { SectionContainer, sectionPadding } from "./section-container";

type CTAProps = {
  isAuthenticated: boolean;
};

export default function CTA({ isAuthenticated }: CTAProps) {
  return (
    <div className="flex flex-col w-full border-t border-border">
      <SectionContainer className={`!max-w-7xl ${sectionPadding}`}>
        <div className="rounded-md border border-border bg-card/40 p-8 sm:p-12 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
          <h2 className="max-w-2xl text-3xl sm:text-4xl font-normal tracking-tight leading-[1.15]">
            Try it on your own codebase.{" "}
            <span className="text-muted-foreground">
              Connect a GitHub or GitLab repo, or upload a zip. Open source and
              self-hostable.
            </span>
          </h2>

          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Button size="lg" className="group" asChild>
              <Link href={isAuthenticated ? "/dashboard/organizations" : "/login"}>
                {isAuthenticated ? "Go to Dashboard" : "Get started"}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/docs/self-hosting">
                <BookOpen className="mr-2 h-4 w-4" />
                Self-hosting docs
              </Link>
            </Button>
          </div>
        </div>
      </SectionContainer>
    </div>
  );
}
