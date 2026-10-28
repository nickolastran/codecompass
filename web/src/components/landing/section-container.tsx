import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SectionContainerProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
  withBorder?: boolean;
}

export function SectionContainer({
  children,
  className,
  noPadding = false,
  withBorder = true,
}: SectionContainerProps) {
  return (
    <div className="flex flex-col w-full">
      <div
        className={cn(
          "w-full mx-auto",
          "max-w-[calc(100%-2rem)] sm:max-w-[calc(100%-4rem)] lg:max-w-7xl xl:max-w-8xl",
          withBorder && "border-x border-border",
          !noPadding && "px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

// Shared styles for the sections below the hero
export const landingCard =
  "rounded-md border border-border bg-card/40 p-6 sm:p-7 flex flex-col";

interface LandingSectionProps {
  children: ReactNode;
  id?: string;
}

// Every section below the hero uses this, so the gaps between them match
export function LandingSection({ children, id }: LandingSectionProps) {
  return (
    <div className="bg-background flex flex-col w-full border-t border-border">
      <SectionContainer className="!max-w-7xl !py-12 sm:!py-16">
        <div id={id} style={{ scrollMarginTop: "100px" }}>
          {children}
        </div>
      </SectionContainer>
    </div>
  );
}

interface SectionHeadingProps {
  label: string;
  title: string;
  children: ReactNode;
}

// Two-tone heading: a short statement, then a muted follow-up sentence
export function SectionHeading({ label, title, children }: SectionHeadingProps) {
  return (
    <div className="max-w-3xl mb-8 sm:mb-10">
      <p className="text-sm font-medium text-accent mb-3">{label}</p>
      <h2 className="text-3xl sm:text-4xl font-normal tracking-tight leading-[1.15]">
        {title} <span className="text-muted-foreground">{children}</span>
      </h2>
    </div>
  );
}
