"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  createContext,
  useContext,
} from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

// Context to share sidebar state with SidebarItems
const SidebarContext = createContext<{ isExpanded: boolean }>({
  isExpanded: false,
});

const COLLAPSED_WIDTH = 60;
const MIN_WIDTH = 120;
const MAX_WIDTH = 320; // even a very long conversation title stops here
const STORAGE_KEY = "sidebar-v2"; // v1 stored fixed widths that predate auto-fit

// Chrome vertical-tabs style: top button toggles icons-only, right edge drags to resize.
// Dragging narrower than COLLAPSE_AT snaps to collapsed; dragging out of collapsed reopens.
const COLLAPSE_AT = (COLLAPSED_WIDTH + MIN_WIDTH) / 2;

// Width at which the longest [data-sidebar-label] shows untruncated.
// offsetLeft/scrollWidth are layout values, so motion's `layout` transforms
// don't skew them; scrollWidth is the full text width even while ellipsized.
function fitWidth(aside: HTMLElement) {
  let fit = MIN_WIDTH;
  aside.querySelectorAll<HTMLElement>("[data-sidebar-label]").forEach((el) => {
    let left = 0;
    for (let n: HTMLElement | null = el; n && n !== aside; ) {
      left += n.offsetLeft;
      n = n.offsetParent as HTMLElement | null;
    }
    // 20 = item + container right padding, 4 = label's hover nudge
    fit = Math.max(fit, left + el.scrollWidth + 24);
  });
  return Math.min(MAX_WIDTH, fit);
}

export function Sidebar({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  // null = fit the longest label; a number = user dragged it narrower
  const [width, setWidth] = useState<number | null>(null);
  const [fit, setFit] = useState(MIN_WIDTH);
  const [dragging, setDragging] = useState(false);
  const asideRef = useRef<HTMLElement>(null);

  // Restore after mount (localStorage isn't available during SSR)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved) {
        setCollapsed(!!saved.collapsed);
        setWidth(typeof saved.width === "number" ? saved.width : null);
      }
    } catch {}
  }, []);

  // Re-measure whenever labels change (page switch, conversations loading in)
  useLayoutEffect(() => {
    const aside = asideRef.current;
    if (!aside || collapsed) return;
    const measure = () => setFit(fitWidth(aside));
    measure();
    const observer = new MutationObserver(measure);
    observer.observe(aside, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [collapsed]);

  const persist = (next: { collapsed: boolean; width: number | null }) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const toggle = () => {
    setCollapsed(!collapsed);
    persist({ collapsed: !collapsed, width });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !asideRef.current) return;
    const x = e.clientX - asideRef.current.getBoundingClientRect().left;
    setCollapsed(x < COLLAPSE_AT);
    // Dragging out to the fit point goes back to auto-fit
    setWidth(x >= fit ? null : Math.max(MIN_WIDTH, x));
  };

  const stopDrag = () => {
    if (!dragging) return;
    setDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    persist({ collapsed, width });
  };

  const shownWidth = collapsed
    ? COLLAPSED_WIDTH
    : Math.max(MIN_WIDTH, Math.min(width ?? fit, fit));

  return (
    <SidebarContext.Provider value={{ isExpanded: !collapsed }}>
      <motion.aside
        ref={asideRef}
        initial={false}
        animate={{ width: shownWidth }}
        transition={
          dragging
            ? { duration: 0 }
            : { type: "spring", stiffness: 300, damping: 30 }
        }
        className="relative shrink-0 h-full bg-background border-r border-border flex flex-col"
      >
        <div className="flex flex-col gap-1 mt-2 w-full px-2 flex-1 min-h-0 overflow-hidden">
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex items-center px-3 py-2 rounded-md w-fit text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            <div className="w-6 h-6 flex items-center justify-center">
              {collapsed ? (
                <PanelLeftOpen className="h-4.5 w-4.5" />
              ) : (
                <PanelLeftClose className="h-4.5 w-4.5" />
              )}
            </div>
          </button>
          {children}
        </div>

        {/* Resize handle: pointer capture keeps the drag alive outside the sidebar */}
        <div
          aria-hidden
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
            document.body.style.cursor = "ew-resize";
            document.body.style.userSelect = "none";
          }}
          onPointerMove={onPointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          className="absolute top-0 -right-1 z-10 h-full w-2 cursor-ew-resize"
        />
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
          data-sidebar-label
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
          title={isExpanded ? undefined : label}
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
          title={isExpanded ? undefined : label}
          className={className}
        >
          {content}
        </button>
      )}
    </motion.div>
  );
}
