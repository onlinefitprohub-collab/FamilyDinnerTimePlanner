import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// notes[weekKey][day] = note text
interface DayNotesStore {
  notes: Record<string, Record<string, string>>;
  setNote: (weekKey: string, day: string, text: string) => void;
  clearNote: (weekKey: string, day: string) => void;
}

export const useDayNotesStore = create<DayNotesStore>()(
  persist(
    (set) => ({
      notes: {},
      setNote: (weekKey, day, text) =>
        set((s) => ({
          notes: {
            ...s.notes,
            [weekKey]: { ...(s.notes[weekKey] ?? {}), [day]: text },
          },
        })),
      clearNote: (weekKey, day) =>
        set((s) => {
          const week = { ...(s.notes[weekKey] ?? {}) };
          delete week[day];
          return { notes: { ...s.notes, [weekKey]: week } };
        }),
    }),
    {
      name: 'day-notes-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
