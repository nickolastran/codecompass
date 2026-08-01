"use client";

import { Button } from "@/components/ui/button";
import { FolderCode, ChevronRight } from "lucide-react";
import { Github } from "@geist-ui/icons";
import { Gitlab } from "@geist-ui/icons";
import { Repo } from "@/app/types/supabase";
import { useRouter } from "next/navigation";
import { usePrefetchRoute } from "@/hooks/usePrefetchRoute";
import { motion } from "framer-motion";

type RepoButtonProps = {
  repo: Repo;
};

export function RepoButton({ repo }: RepoButtonProps) {
  const router = useRouter();
  const type = repo.provider;
  const index_status = repo.index_status;
  const { prefetchRepoPage } = usePrefetchRoute();

  return (
    <motion.div whileHover="hover" className="parent">
      <Button
        variant="outline"
        className="bg-background h-auto min-h-21 justify-start p-4 w-full hover:bg-elevated"
        onClick={() => router.push(`/dashboard/repo/${repo.id}`)}
        onMouseEnter={() => prefetchRepoPage(repo.id)}
      >
        <div className="flex flex-row gap-4 text-sm w-full overflow-hidden">
          {/* Surround in a circular container */}
          <div className="rounded-full dark:bg-black border-2 border-primary p-2.5 shrink-0">
            {type === "github" ? (
              <Github className="w-4 h-4" />
            ) : type === "gitlab" ? (
              <Gitlab className="w-4 h-4" />
            ) : (
              <FolderCode className="w-4 h-4 text-white" />
            )}
          </div>
          <div className="flex flex-col justify-start items-start min-w-0 flex-1">
            <span className="font-semibold truncate">{repo.name}</span>
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {type === "github"
                ? "GitHub"
                : type === "gitlab"
                  ? "GitLab"
                  : "Local"}{" "}
              <span className="text-md">&middot;</span>{" "}
              {index_status || "Not Indexed"}
            </span>
          </div>
          <motion.div
            initial={{ opacity: 0.5 }}
            variants={{ hover: { x: 4, opacity: 1 } }}
          >
            <ChevronRight className="text-primary-foreground" />
          </motion.div>
        </div>
      </Button>
    </motion.div>
  );
}
