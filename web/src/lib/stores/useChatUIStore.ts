import { create } from "zustand";
import { Conversation } from "@/app/types/supabase";

interface ChatUIState {
  isExpanded: boolean;
  initialMessage: string;
  conversation: Conversation | null;
  hasDocumentation: boolean;
  repoId: string | null;
  selectedVersion: number | null;
  expand: (message: string) => void;
  minimize: () => void;
  toggle: () => void;
  setHasDocumentation: (hasDocumentation: boolean) => void;
  setRepoId: (repoId: string) => void;
  setSelectedVersion: (version: number | null) => void;
  startNewConversation: () => void;
  setConversation: (conversation: Conversation | null) => void;
  reset: () => void;
}

export const useChatUIStore = create<ChatUIState>((set) => ({
  isExpanded: false,
  initialMessage: "",
  conversation: null,
  hasDocumentation: false,
  repoId: null,
  selectedVersion: null,
  expand: (message: string) =>
    set({ isExpanded: true, initialMessage: message }),
  minimize: () => set({ isExpanded: false, initialMessage: "" }),
  toggle: () => set((state) => ({ isExpanded: !state.isExpanded })),
  setHasDocumentation: (hasDocumentation: boolean) => set({ hasDocumentation }),
  setRepoId: (repoId: string) => set({ repoId }),
  setSelectedVersion: (version: number | null) =>
    set({ selectedVersion: version }),
  startNewConversation: () => set({ conversation: null, initialMessage: "" }),
  setConversation: (conversation: Conversation | null) => set({ conversation }),
  reset: () =>
    set({
      isExpanded: false,
      initialMessage: "",
      conversation: null,
      hasDocumentation: false,
      repoId: null,
      selectedVersion: null,
    }),
}));
