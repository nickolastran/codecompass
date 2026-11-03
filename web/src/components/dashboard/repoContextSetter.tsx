"use client";

import { useEffect } from "react";
import { useChatUIStore } from "@/lib/stores/useChatUIStore";

export function RepoContextSetter({
  repoId,
  version,
}: {
  repoId: string;
  version: number | null;
}) {
  const setRepoId = useChatUIStore((state) => state.setRepoId);
  const setSelectedVersion = useChatUIStore(
    (state) => state.setSelectedVersion,
  );
  const reset = useChatUIStore((state) => state.reset);

  useEffect(() => {
    setRepoId(repoId);
    setSelectedVersion(version);

    // Cleanup when component unmounts (user navigates away)
    return () => {
      reset();
    };
  }, [repoId, version, setRepoId, setSelectedVersion, reset]);

  return null;
}
