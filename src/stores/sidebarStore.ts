import { create } from 'zustand';

interface SidebarState {
  hoveredItem: string | null;
  setHoveredItem: (item: string | null) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  hoveredItem: null,
  setHoveredItem: (item) => set({ hoveredItem: item }),
}));
