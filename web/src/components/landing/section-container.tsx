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
