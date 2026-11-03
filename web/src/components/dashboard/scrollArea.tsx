"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function ScrollArea({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Reset scroll position when pathname changes
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [pathname]);

  return (
    <main ref={mainRef} className="flex-1 overflow-y-auto">
      {children}
    </main>
  );
}
