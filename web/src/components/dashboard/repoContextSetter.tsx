"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useChatUIStore } from "@/lib/stores/useChatUIStore";
import { Conversation } from "@/app/types/supabase";
import { getConversationById } from "@/lib/services/repoService";

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
  const queryClient = useQueryClient();
  // ?chat=<conversationId> (or ?chat= for a new chat) means the chat is open
  const chatParam = useSearchParams().get("chat");

  useEffect(() => {
    setRepoId(repoId);
    setSelectedVersion(version);

    // Cleanup when component unmounts (user navigates away)
    return () => {
      reset();
    };
  }, [repoId, version, setRepoId, setSelectedVersion, reset]);

  // URL -> chat: on load, refresh, Back/Forward and links to ?chat
  useEffect(() => {
    const state = useChatUIStore.getState();
    if (chatParam === null) {
      if (state.isExpanded) state.minimize();
      return;
    }
    if (chatParam === (state.conversation?.id ?? "")) {
      useChatUIStore.setState({ isExpanded: true });
      return;
    }
    // New chat, or a conversation already in the prefetched recent list: open right away
    const cached = queryClient
      .getQueryData<Conversation[]>(["conversations", repoId, version])
      ?.find((c) => c.id === chatParam);
    if (chatParam === "" || cached) {
      useChatUIStore.setState({ isExpanded: true, conversation: cached ?? null });
      return;
    }
    // Older conversation: fetch it, falling back to a new chat if it's gone or another repo's.
    // The store is left alone until then so the URL isn't rewritten mid-fetch.
    let stale = false;
    getConversationById(chatParam).then((result) => {
      if (stale) return;
      useChatUIStore.setState({
        isExpanded: true,
        conversation:
          result.success && result.data.repo_id === repoId ? result.data : null,
      });
    });
    return () => {
      stale = true;
    };
  }, [chatParam, queryClient, repoId, version]);

  // Chat -> URL
  useEffect(
    () =>
      useChatUIStore.subscribe((state, prev) => {
        // reset() on unmount clears repoId; the URL has already moved on
        if (!state.repoId) return;
        // Only chat open/close and conversation changes belong in the URL
        if (
          state.isExpanded === prev.isExpanded &&
          state.conversation === prev.conversation
        )
          return;
        const url = new URL(window.location.href);
        if (state.isExpanded) {
          url.searchParams.set("chat", state.conversation?.id ?? "");
        } else {
          url.searchParams.delete("chat");
        }
        if (url.href === window.location.href) return;
        // Opening/closing adds a history entry so Back closes the chat;
        // switching conversations replaces it
        if (state.isExpanded !== prev.isExpanded) {
          window.history.pushState(null, "", url);
        } else {
          window.history.replaceState(null, "", url);
        }
      }),
    [],
  );

  return null;
}
