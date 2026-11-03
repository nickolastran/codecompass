"use client";

import { Button } from "@/components/ui/button";
import { FolderCode, ChevronRight } from "lucide-react";
import { Github } from "@geist-ui/icons";
import { Gitlab } from "@geist-ui/icons";
import { Repo } from "@/app/types/supabase";
import Link from "next/link";
import { repoHref } from "@/lib/repo-href";
import { motion } from "framer-motion";

// [label, dot color]; anything unknown falls back to "Not indexed"
const STATUS: Record<string, [string, string]> = {
  indexed: ["Indexed", "bg-primary"],
  indexing: ["Indexing", "bg-amber-500 animate-pulse"],
  pending: ["Queued", "bg-amber-500 animate-pulse"],
  failed: ["Failed", "bg-destructive"],
};

type RepoButtonProps = {
  repo: Repo;
};

export function RepoButton({ repo }: RepoButtonProps) {
  const type = repo.provider;
  const [statusLabel, statusDot] = STATUS[repo.index_status] ?? [
    "Not indexed",
    "bg-muted-foreground",
  ];

  return (
    <motion.div whileHover="hover" className="parent">
      <Button
        variant="outline"
        className="bg-background h-auto min-h-21 justify-start p-4 w-full hover:bg-elevated"
        asChild
      >
        <Link href={repoHref(repo)}>
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
              <span className="flex items-center gap-1.5 text-muted-foreground text-xs whitespace-nowrap">
                {type === "github"
                  ? "GitHub"
                  : type === "gitlab"
                    ? "GitLab"
                    : "Local"}
                <span className="text-md">&middot;</span>
                <span className={`size-1.5 rounded-full ${statusDot}`} />
                {statusLabel}
              </span>
            </div>
            <motion.div
              initial={{ opacity: 0.5 }}
              variants={{ hover: { x: 4, opacity: 1 } }}
            >
              <ChevronRight className="text-primary-foreground" />
            </motion.div>
          </div>
        </Link>
      </Button>
    </motion.div>
  );
}
