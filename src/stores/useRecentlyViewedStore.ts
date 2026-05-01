import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_RECENT = 20;

interface RecentlyViewedStore {
  ids: string[];
  addView: (recipeId: string) => void;
  clear: () => void;
}

export const useRecentlyViewedStore = create<RecentlyViewedStore>()(
  persist(
    (set) => ({
      ids: [],
      addView: (recipeId) =>
        set((s) => {
          const filtered = s.ids.filter((id) => id !== recipeId);
          return { ids: [recipeId, ...filtered].slice(0, MAX_RECENT) };
        }),
      clear: () => set({ ids: [] }),
    }),
    {
      name: 'recently-viewed-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
