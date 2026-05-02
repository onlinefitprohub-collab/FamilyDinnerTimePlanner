import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ShoppingCheckedStore {
  checkedIds: string[];
  weekKey: string;
  uncheck: (id: string, currentWeekKey: string) => void;
  toggle: (id: string, currentWeekKey: string) => void;
  clearForWeek: (weekKey: string) => void;
}

export const useShoppingCheckedStore = create<ShoppingCheckedStore>()(
  persist(
    (set, get) => ({
      checkedIds: [],
      weekKey: '',

      uncheck: (id, currentWeekKey) =>
        set((s) => {
          const base = s.weekKey === currentWeekKey ? s.checkedIds : [];
          return { checkedIds: base.filter((x) => x !== id), weekKey: currentWeekKey };
        }),

      toggle: (id, currentWeekKey) => {
        const { checkedIds, weekKey } = get();
        const base = weekKey === currentWeekKey ? checkedIds : [];
        if (base.includes(id)) {
          set({ checkedIds: base.filter((x) => x !== id), weekKey: currentWeekKey });
        } else {
          set({ checkedIds: [...base, id], weekKey: currentWeekKey });
        }
      },

      clearForWeek: (weekKey) =>
        set((s) => s.weekKey === weekKey ? { checkedIds: [] } : {}),
    }),
    {
      name: 'shopping-checked-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
