"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useNavBarStore } from "@/lib/stores/useNavbarStore";
import { useChatUIStore } from "@/lib/stores/useChatUIStore";
import Link from "next/link";

// Map route patterns to display names
const routeDisplayNames: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/organizations": "Organizations",
  "/dashboard/repositories": "Repositories",
  "/dashboard/documentation": "Documentation",
  "/dashboard/chat": "Chat",
  "/dashboard/new": "New Organization",
};

export function NavContext() {
  const pathname = usePathname();
  const { contextText, breadcrumbs } = useNavBarStore();
  const minimize = useChatUIStore((state) => state.minimize);

  const handleBreadcrumbClick = () => {
    // Reset chat state when navigating away
    minimize();
  };

  // Derive context from URL as fallback
  const defaultContext = useMemo(() => {
    // Check for exact matches first
    if (routeDisplayNames[pathname]) {
      return routeDisplayNames[pathname];
    }

    // Handle dynamic routes
    if (pathname.startsWith("/dashboard/org/")) {
      return "Organization";
    }
    if (pathname.startsWith("/dashboard/repo/")) {
      return "Repository";
    }
    if (pathname.startsWith("/dashboard/new/")) {
      return "New Repository";
    }

    // Default fallback
    return "Dashboard";
  }, [pathname]);

  // If breadcrumbs are set, display them
  if (breadcrumbs && breadcrumbs.length > 0) {
    return (
      <div className="flex items-center gap-2">
        {breadcrumbs.map((crumb, index) => (
          <div key={index} className="flex items-center gap-2">
            {crumb.href ? (
              <Link
                href={crumb.href}
                prefetch={true}
                onClick={handleBreadcrumbClick}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="font-semibold text-foreground text-sm">
                {crumb.label}
              </span>
            )}
            {index < breadcrumbs.length - 1 && (
              <span className="text-muted-foreground">/</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Use store context if it's not the default, otherwise use URL-based fallback
  const displayText =
    contextText !== "Dashboard" ? contextText : defaultContext;

  return (
    <span className="font-semibold text-foreground text-sm">{displayText}</span>
  );
}
