import { create } from "zustand";

interface VersionInfo {
  version: number;
  createdAt: string;
  updatedAt: string | null;
}

interface DocumentationState {
  selectedVersion: number | null;
  availableVersions: VersionInfo[];
  isLoading: boolean;
  isIndexing: boolean;

  // Actions
  selectVersion: (version: number) => void;
  setAvailableVersions: (versions: VersionInfo[]) => void;
  setIsLoading: (loading: boolean) => void;
  setIsIndexing: (indexing: boolean) => void;
  reset: () => void;
}

export const useDocumentationStore = create<DocumentationState>((set) => ({
  selectedVersion: null,
  availableVersions: [],
  isLoading: false,
  isIndexing: false,

  selectVersion: (version) => set({ selectedVersion: version }),
  setAvailableVersions: (versions) => set({ availableVersions: versions }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsIndexing: (indexing) => set({ isIndexing: indexing }),
  reset: () =>
    set({
      selectedVersion: null,
      availableVersions: [],
      isLoading: false,
      isIndexing: false,
    }),
}));
