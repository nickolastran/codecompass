import { create } from "zustand";

interface VersionInfo {
  version: number;
  createdAt: string;
  updatedAt: string | null;
}

// Shared with the version pickers (docs header, chat). Indexing/loading state
// lives in DocumentationViewer, derived from the repo's index_status.
interface DocumentationState {
  selectedVersion: number | null;
  availableVersions: VersionInfo[];

  selectVersion: (version: number) => void;
  setAvailableVersions: (versions: VersionInfo[]) => void;
  reset: () => void;
}

export const useDocumentationStore = create<DocumentationState>((set) => ({
  selectedVersion: null,
  availableVersions: [],

  selectVersion: (version) => set({ selectedVersion: version }),
  setAvailableVersions: (versions) => set({ availableVersions: versions }),
  reset: () => set({ selectedVersion: null, availableVersions: [] }),
}));
