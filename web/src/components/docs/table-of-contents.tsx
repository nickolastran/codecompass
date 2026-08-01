"use client";

import { ArrowUp, X } from "lucide-react";
import { useEffect, useState } from "react";

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface DocsTableOfContentsProps {
  headings: Heading[];
  isOpen?: boolean;
  onClose?: () => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export function DocsTableOfContents({
  headings,
  isOpen = false,
  onClose,
  scrollContainerRef,
}: DocsTableOfContentsProps) {
  const [activeHeading, setActiveHeading] = useState<string>("");
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    if (headings.length === 0) return;

    const handleScroll = () => {
      const scrollContainer = scrollContainerRef?.current;

      const headingElements = headings
        .map((heading) => {
          const element = document.getElementById(heading.id);
          return { id: heading.id, element };
        })
        .filter((item) => item.element) as {
        id: string;
        element: HTMLElement;
      }[];

      if (headingElements.length === 0) return;

      const scrollPosition = scrollContainer
        ? scrollContainer.scrollTop + 100
        : window.scrollY + 100;

      for (let i = headingElements.length - 1; i >= 0; i--) {
        const { id, element } = headingElements[i];
        if (element.offsetTop <= scrollPosition) {
          setActiveHeading(id);
          break;
        }
      }

      // Calculate scroll percentage for back-to-top button
      if (scrollContainer) {
        const scrollPercentage =
          (scrollContainer.scrollTop /
            (scrollContainer.scrollHeight - scrollContainer.clientHeight)) *
          100;
        setShowBackToTop(scrollPercentage > 20);
      } else {
        const scrollPercentage =
          (window.scrollY /
            (document.documentElement.scrollHeight - window.innerHeight)) *
          100;
        setShowBackToTop(scrollPercentage > 20);
      }
    };

    if (scrollContainerRef?.current) {
      const container = scrollContainerRef.current;
      container.addEventListener("scroll", handleScroll);
      handleScroll();
      return () => container.removeEventListener("scroll", handleScroll);
    } else {
      window.addEventListener("scroll", handleScroll);
      handleScroll();
      return () => window.removeEventListener("scroll", handleScroll);
    }
  }, [headings, scrollContainerRef]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.offsetTop;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  const scrollToTop = () => {
    const scrollContainer = scrollContainerRef?.current;
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } else {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  if (headings.length === 0) return null;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
        w-64 shrink-0
        lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-8rem)]
        ${isOpen ? "fixed right-0 top-0 h-screen z-50 bg-background border-l border-border" : "hidden lg:block"}
      `}
      >
        {/* Mobile close button */}
        {onClose && (
          <div className="lg:hidden p-4 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold">Table of Contents</span>
            <button onClick={onClose} className="p-1 hover:bg-border rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Table of contents */}
        <div className="p-6 max-h-[calc(100vh-12rem)] overflow-y-auto">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            On this page
          </h3>
          <nav className="space-y-1">
            {headings.map((heading) => (
              <button
                key={heading.id}
                onClick={() => {
                  scrollToHeading(heading.id);
                  if (onClose) onClose();
                }}
                className={`block text-sm py-1.5 transition-colors text-left w-full rounded px-2 ${
                  activeHeading === heading.id
                    ? "text-teal-400 font-medium bg-teal-400/10"
                    : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/50"
                }`}
                style={{ paddingLeft: `${(heading.level - 1) * 12 + 8}px` }}
              >
                {heading.text}
              </button>
            ))}
          </nav>
        </div>

        {/* Back to Top Button */}
        {showBackToTop && (
          <div className="p-6 pt-0">
            <button
              onClick={scrollToTop}
              className="w-full py-2 bg-gray-800 hover:bg-teal-600 border border-gray-700 rounded flex items-center justify-center gap-2 transition-all duration-200 text-sm text-gray-300 hover:text-white"
              title="Back to top"
            >
              <ArrowUp className="w-4 h-4" />
              Back to top
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
