"use client";

import { useState, createContext, useContext } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Context to share sidebar state with SidebarItems
const SidebarContext = createContext<{ isExpanded: boolean }>({
  isExpanded: false,
});

export function Sidebar({ children }: { children: React.ReactNode }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <SidebarContext.Provider value={{ isExpanded: isHovered }}>
      <motion.aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        // Keyboard users get the labels too
        onFocus={() => setIsHovered(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setIsHovered(false);
        }}
        animate={{ width: isHovered ? 200 : 60 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="h-screen bg-background border-r border-border flex flex-col overflow-hidden"
      >
        <div className="flex flex-col items-center w-full">
          <div className="flex flex-col gap-1 mt-4 w-full px-2">{children}</div>
        </div>
      </motion.aside>
    </SidebarContext.Provider>
  );
}

// Hook to access sidebar state
export function useSidebar() {
  return useContext(SidebarContext);
}

// Sidebar item that shows icon when collapsed, icon + label when expanded.
// Pass href for navigation (a real link: new-tab clicks work, current page is highlighted),
// action for in-page toggles.
export function SidebarItem({
  icon,
  label,
  href,
  action,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  action?: () => void;
  disabled?: boolean;
}) {
  const { isExpanded } = useSidebar();
  const pathname = usePathname();
  const active = href !== undefined && pathname === href;

  const className = `flex items-center gap-3 px-3 py-2 rounded-md transition-colors w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring ${
    disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted cursor-pointer"
  } ${active ? "bg-muted" : ""}`;

  const content = (
    <>
      <div className="shrink-0 w-6 h-6 flex items-center justify-center">
        {icon}
      </div>
      {isExpanded && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          whileHover={disabled ? {} : { x: 4 }}
          transition={{ duration: 0.3 }}
          className="text-sm text-foreground truncate whitespace-nowrap"
        >
          {label}
        </motion.span>
      )}
    </>
  );

  return (
    <motion.div layout transition={{ duration: 0.3, ease: "easeInOut" }}>
      {href && !disabled ? (
        <Link
          href={href}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          className={className}
        >
          {content}
        </Link>
      ) : (
        <button
          type="button"
          onClick={action}
          disabled={disabled}
          aria-label={label}
          className={className}
        >
          {content}
        </button>
      )}
    </motion.div>
  );
}
