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
  CircleUser,
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

  const { toggle, expand, isExpanded: chatExpanded } = useChatUIStore();

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
    if (
      (pathname.startsWith("/dashboard/repo/") && id) ||
      (params.owner && params.repo)
    ) {
      // For repos, "id" is the repo's base path: /dashboard/repo/<id> or /dashboard/<owner>/<repo>
      return { type: "repository", id: pathname.replace(/\/settings$/, "") };
    }
    return { type: "default", id: null };
  }, [pathname, id, params.owner, params.repo]);

  // Render different sidebar items based on context
  const renderContextualItems = () => {
    switch (currentContext.type) {
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
        if (pathname.includes("/settings")) {
          const repoPath = currentContext.id!;
          return (
            <>
              <SidebarItem
                icon={<BookOpen className="h-4.5 w-4.5" />}
                label="Documentation"
                action={() => router.push(repoPath)}
              />
              <SidebarItem
                icon={<MessageSquare className="h-4.5 w-4.5" />}
                label="Chat"
                action={() => {
                  router.push(repoPath);
                  expand("");
                }}
              />
              <SidebarItem
                icon={<Settings className="h-4.5 w-4.5" />}
                label="Settings"
                action={() => router.push(`${repoPath}/settings`)}
              />
            </>
          );
        }
        return (
          <>
            <SidebarItem
              icon={
                chatExpanded ? (
                  <BookOpen className="h-4.5 w-4.5" />
                ) : (
                  <MessageSquare className="h-4.5 w-4.5" />
                )
              }
              label={chatExpanded ? "Documentation" : "Chat"}
              action={toggle}
              disabled={!hasDocumentation}
            />
            {chatExpanded && (
              <SidebarItem
                icon={<MessageSquarePlus className="h-4.5 w-4.5" />}
                label="New Message"
                action={() => {
                  const { startNewConversation } = useChatUIStore.getState();
                  startNewConversation();
                }}
              />
            )}

            {chatExpanded && <ConversationPanel />}
            <SidebarItem
              icon={<Settings className="h-4.5 w-4.5" />}
              label="Settings"
              action={() =>
                router.push(`${currentContext.id}/settings`)
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
              icon={<CircleUser className="h-4.5 w-4.5" />}
              label="Profile"
              action={() => router.push("/dashboard/profile")}
            />
          </>
        );
    }
  };

  // Only nav item here would be the current page
  if (currentContext.type === "organizations") return null;

  return <Sidebar>{renderContextualItems()}</Sidebar>;
}
