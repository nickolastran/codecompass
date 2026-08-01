"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GitLabProject } from "@/app/types/gitlab";
import { importGitLabRepositories } from "@/lib/actions/gitlab";
import { Search, Gitlab } from "@geist-ui/icons";

type GitLabRepoSelectorProps = {
  projects: GitLabProject[];
  orgId: string;
};

export function GitLabRepoSelector({
  projects,
  orgId,
}: GitLabRepoSelectorProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<Set<number>>(
    new Set(),
  );
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.path_with_namespace
        .toLowerCase()
        .includes(searchQuery.toLowerCase()),
  );

  const toggleProject = (projectId: number) => {
    const newSelected = new Set(selectedProjects);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedProjects(newSelected);
  };

  const handleImport = async () => {
    if (selectedProjects.size === 0) return;

    setIsImporting(true);
    setError(null);

    try {
      const selectedProjectsList = projects.filter((p) =>
        selectedProjects.has(p.id),
      );

      // Import selected projects using server action
      const result = await importGitLabRepositories(
        selectedProjectsList,
        orgId,
      );

      if (!result.success) {
        setError(result.error);
        setIsImporting(false);
        return;
      }

      // Redirect back to organization page
      const importCount = result.data.length;
      router.push(`/dashboard/org/${orgId}?gitlab_imported=${importCount}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to import repositories",
      );
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search repositories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Selected Count */}
      {selectedProjects.size > 0 && (
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <span className="text-sm font-medium">
            {selectedProjects.size} repository
            {selectedProjects.size !== 1 ? "ies" : ""} selected
          </span>
          <Button onClick={handleImport} disabled={isImporting} size="sm">
            {isImporting
              ? "Importing..."
              : `Import ${selectedProjects.size} Repository${selectedProjects.size !== 1 ? "ies" : ""}`}
          </Button>
        </div>
      )}

      {/* Projects List */}
      <div className="space-y-3">
        {filteredProjects.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {searchQuery
                ? "No repositories found matching your search"
                : "No repositories found"}
            </p>
          </Card>
        ) : (
          filteredProjects.map((project) => (
            <Card
              key={project.id}
              className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                selectedProjects.has(project.id)
                  ? "border-primary bg-primary/5"
                  : ""
              }`}
              onClick={() => toggleProject(project.id)}
            >
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  checked={selectedProjects.has(project.id)}
                  onChange={() => toggleProject(project.id)}
                  className="mt-1 h-4 w-4 rounded border-input"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Gitlab className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <h3 className="font-semibold truncate">
                      {project.path_with_namespace}
                    </h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        project.visibility === "public"
                          ? "bg-green-500/10 text-green-700 dark:text-green-400"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {project.visibility}
                    </span>
                  </div>
                  {project.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Branch: {project.default_branch}</span>
                    <span>
                      Updated:{" "}
                      {new Date(project.last_activity_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Separator />

      {/* Footer Actions */}
      <div className="flex gap-3 justify-end">
        <Button
          variant="outline"
          onClick={() => router.push(`/dashboard/org/${orgId}`)}
          disabled={isImporting}
        >
          Cancel
        </Button>
        <Button
          onClick={handleImport}
          disabled={selectedProjects.size === 0 || isImporting}
        >
          {isImporting
            ? "Importing..."
            : `Import ${selectedProjects.size > 0 ? selectedProjects.size : ""} ${selectedProjects.size > 0 ? "Selected" : "Repositories"}`}
        </Button>
      </div>
    </div>
  );
}
