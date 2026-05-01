import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotesStore {
  notes: Record<string, string>;
  setNote: (recipeId: string, text: string) => void;
  clearNote: (recipeId: string) => void;
}

export const useNotesStore = create<NotesStore>()(
  persist(
    (set) => ({
      notes: {},
      setNote: (recipeId, text) =>
        set((s) => ({ notes: { ...s.notes, [recipeId]: text } })),
      clearNote: (recipeId) =>
        set((s) => {
          const next = { ...s.notes };
          delete next[recipeId];
          return { notes: next };
        }),
    }),
    {
      name: 'notes-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
