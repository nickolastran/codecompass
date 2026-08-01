"use client";

import { Check, ChevronDown, History } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDocumentationStore } from "@/lib/stores/useDocumentationStore";

export default function VersionSelector() {
  const selectedVersion = useDocumentationStore(
    (state) => state.selectedVersion,
  );
  const availableVersions = useDocumentationStore(
    (state) => state.availableVersions,
  );
  const selectVersion = useDocumentationStore((state) => state.selectVersion);

  // If no versions available, don't render
  if (availableVersions.length === 0) {
    return null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-card hover:bg-accent/10 border border-border rounded-lg transition-colors text-sm">
          <div className="flex items-center gap-2">
            <History className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground text-xs">Version</span>
            <span className="text-foreground font-medium text-xs">
              {selectedVersion ?? "N/A"}
            </span>
          </div>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="bg-card border-border"
        align="start"
        sideOffset={8}
      >
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          SELECT VERSION
        </DropdownMenuLabel>

        <DropdownMenuGroup>
          {availableVersions.map((version) => (
            <DropdownMenuItem
              key={version.version}
              onClick={() => selectVersion(version.version)}
              className={`cursor-pointer ${
                selectedVersion === version.version
                  ? "text-foreground focus:text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <div className="flex items-start justify-between gap-2 w-full">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      Version {version.version}
                    </span>
                    {version.version ===
                      availableVersions[0]?.version && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
                        Latest
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(version.createdAt)}
                  </div>
                </div>

                {selectedVersion === version.version && (
                  <Check className="w-4 h-4 shrink-0 text-accent" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
