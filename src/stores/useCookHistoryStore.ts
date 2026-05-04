import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// history[recipeId] = ISO date strings, newest first
interface CookHistoryStore {
  history: Record<string, string[]>;
  addCook: (recipeId: string) => void;
  getCount: (recipeId: string) => number;
  getLastCooked: (recipeId: string) => string | null;
}

export const useCookHistoryStore = create<CookHistoryStore>()(
  persist(
    (set, get) => ({
      history: {},
      addCook: (recipeId) =>
        set((s) => ({
          history: {
            ...s.history,
            [recipeId]: [new Date().toISOString(), ...(s.history[recipeId] ?? [])],
          },
        })),
      getCount: (recipeId) => get().history[recipeId]?.length ?? 0,
      getLastCooked: (recipeId) => get().history[recipeId]?.[0] ?? null,
    }),
    {
      name: 'cook-history-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
