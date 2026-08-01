import { create } from "zustand";

interface NavbarState {
  contextText: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  setContext: (text: string) => void;
  setBreadcrumbs: (
    breadcrumbs: Array<{ label: string; href?: string }>,
  ) => void;
  appendBreadcrumb: (breadcrumb: { label: string; href?: string }) => void;
  reset: () => void;
}

export const useNavBarStore = create<NavbarState>((set) => ({
  contextText: "Dashboard",
  breadcrumbs: undefined,
  setContext: (text) => set({ contextText: text }),
  setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),
  appendBreadcrumb: (breadcrumb) =>
    set((state) => ({
      breadcrumbs: [...(state.breadcrumbs || []), breadcrumb],
    })),
  reset: () => set({ contextText: "Dashboard", breadcrumbs: undefined }),
}));
