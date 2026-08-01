"use client";

import { usePathname, useParams } from "next/navigation";
import { Sidebar, SidebarItem } from "@/components/dashboard/sidebar";
import {
  FolderCode,
  Building2,
  Users,
  Settings,
  BookOpen,
  MessageSquare,
  MessageSquarePlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useChatUIStore } from "@/lib/stores/useChatUIStore";
import ConversationPanel from "./conversation-panel";

export function DashboardSidebar() {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const { hasDocumentation } = useChatUIStore();

  const { toggle, isExpanded: chatExpanded } = useChatUIStore();

  // Access dynamic route parameters
  const id = params.id as string | undefined;

  // Determine the current context based on pathname patterns
  const currentContext = useMemo(() => {
    if (pathname.startsWith("/dashboard/organizations")) {
      return { type: "organizations", id };
    }
    if (pathname.startsWith("/dashboard/org/") && id) {
      return { type: "org", id };
    }
    if (pathname.startsWith("/dashboard/repo/") && id) {
      return { type: "repository", id };
    }
    return { type: "default", id: null };
  }, [pathname, id]);

  // Render different sidebar items based on context
  const renderContextualItems = () => {
    switch (currentContext.type) {
      case "organizations":
        return (
          <>
            <SidebarItem
              icon={<Building2 className="h-4.5 w-4.5" />}
              label="Organizations"
              action={() => router.push(`/dashboard/organizations`)}
            />
          </>
        );

      case "org":
        return (
          <>
            <SidebarItem
              icon={<FolderCode className="h-4.5 w-4.5" />}
              label="Repositories"
              action={() => router.push(`/dashboard/org/${currentContext.id}`)}
            />
            <SidebarItem
              icon={<Users className="h-4.5 w-4.5" />}
              label="Team"
              action={() =>
                router.push(`/dashboard/org/${currentContext.id}/team`)
              }
            />
            <SidebarItem
              icon={<Settings className="h-4.5 w-4.5" />}
              label="Settings"
              action={() =>
                router.push(`/dashboard/org/${currentContext.id}/settings`)
              }
            />
          </>
        );

      case "repository":
        return (
          <>
            <SidebarItem
              icon={
                chatExpanded || pathname.includes("/settings") ? (
                  <BookOpen className="h-4.5 w-4.5" />
                ) : (
                  <MessageSquare className="h-4.5 w-4.5" />
                )
              }
              label={
                chatExpanded || pathname.includes("/settings")
                  ? "Documentation"
                  : "Chat"
              }
              action={() => {
                // Navigate to repo page if not already there
                if (pathname !== `/dashboard/repo/${currentContext.id}`) {
                  router.push(`/dashboard/repo/${currentContext.id}`);
                }
                toggle();
              }}
              disabled={!hasDocumentation && !pathname.includes("/settings")}
            />
            {!pathname.includes("/settings") && chatExpanded && (
              <SidebarItem
                icon={<MessageSquarePlus className="h-4.5 w-4.5" />}
                label="New Message"
                action={() => {
                  const { startNewConversation } = useChatUIStore.getState();
                  startNewConversation();
                }}
              />
            )}

            {!pathname.includes("/settings") && chatExpanded && (
              <ConversationPanel />
            )}
            <SidebarItem
              icon={<Settings className="h-4.5 w-4.5" />}
              label="Settings"
              action={() =>
                router.push(`/dashboard/repo/${currentContext.id}/settings`)
              }
            />
          </>
        );

      default:
        return (
          <>
            <SidebarItem
              icon={<Building2 className="h-4.5 w-4.5" />}
              label="Organizations"
              action={() => router.push("/dashboard/organizations")}
            />
            <SidebarItem
              icon={<Settings className="h-4.5 w-4.5" />}
              label="Settings"
              action={() => router.push("/dashboard/organizations")}
            />
          </>
        );
    }
  };

  return <Sidebar>{renderContextualItems()}</Sidebar>;
}
