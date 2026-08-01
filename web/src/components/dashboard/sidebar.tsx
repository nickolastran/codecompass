"use client";

import { useState, createContext, useContext } from "react";
import { motion } from "motion/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

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

// Sidebar item that shows icon when collapsed, icon + label when expanded
export function SidebarItem({
  icon,
  label,
  action,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  action?: () => void;
  disabled?: boolean;
}) {
  const { isExpanded } = useSidebar();

  const handleClick = () => {
    if (!disabled && action) {
      action();
    }
  };

  return (
    <motion.div
      layout
      transition={{ duration: 0.3, ease: "easeInOut" }}
      onClick={handleClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors w-full ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-muted cursor-pointer"
      }`}
    >
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
    </motion.div>
  );
}

// Sidebar dropdown item with submenu
export function SidebarDropdownItem({
  icon,
  label,
  items,
}: {
  icon: React.ReactNode;
  label: string;
  items: Array<{
    label: string;
    icon?: React.ReactNode;
    action: () => void;
  }>;
}) {
  const { isExpanded: sideBarExpanded } = useSidebar();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex items-center gap-3 px-3 py-2 hover:bg-muted rounded-md cursor-pointer transition-colors w-full">
          <div className="shrink-0 w-6 h-6 flex items-center justify-center">
            {icon}
          </div>
          {sideBarExpanded && (
            <>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                whileHover={{ x: 4 }}
                className="text-sm text-foreground truncate whitespace-nowrap flex-1"
              >
                {label}
              </motion.span>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </motion.div>
            </>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="w-48">
        {items.map((item, index) => (
          <DropdownMenuItem key={index} onClick={item.action}>
            {item.icon && <span className="mr-2">{item.icon}</span>}
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
