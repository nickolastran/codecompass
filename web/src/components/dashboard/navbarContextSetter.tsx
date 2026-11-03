"use client";

import { useEffect } from "react";
import { useNavBarStore } from "@/lib/stores/useNavbarStore";

interface NavbarContextSetterProps {
  contextText?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  appendBreadcrumb?: { label: string; href?: string };
}

/**
 * Client component that sets the navbar context.
 * Use this in Server Components to update the navbar state.
 *
 * @param contextText - Simple text to display (no breadcrumbs)
 * @param breadcrumbs - Complete breadcrumb trail (replaces existing)
 * @param appendBreadcrumb - Single breadcrumb to append to existing trail
 */
export function NavbarContextSetter({
  contextText,
  breadcrumbs,
  appendBreadcrumb,
}: NavbarContextSetterProps) {
  const setContext = useNavBarStore((state) => state.setContext);
  const setBreadcrumbs = useNavBarStore((state) => state.setBreadcrumbs);
  const appendBreadcrumbAction = useNavBarStore(
    (state) => state.appendBreadcrumb,
  );
  const reset = useNavBarStore((state) => state.reset);

  useEffect(() => {
    if (breadcrumbs) {
      setBreadcrumbs(breadcrumbs);
    } else if (appendBreadcrumb) {
      appendBreadcrumbAction(appendBreadcrumb);
    } else if (contextText) {
      setContext(contextText);
    }

    // Clean up on unmount
    return () => {
      reset();
    };
  }, [
    contextText,
    breadcrumbs,
    appendBreadcrumb,
    setContext,
    setBreadcrumbs,
    appendBreadcrumbAction,
    reset,
  ]);

  // This component doesn't render anything
  return null;
}
