import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ShoppingCheckedStore {
  // Persisted as array; weekKey tracks which week the checks belong to
  checkedIds: string[];
  weekKey: string;
  check: (id: string, currentWeekKey: string) => void;
  uncheck: (id: string, currentWeekKey: string) => void;
  toggle: (id: string, currentWeekKey: string) => void;
  clearForWeek: (weekKey: string) => void;
  // Returns a Set of checked ids, auto-clearing if week has changed
  getChecked: (currentWeekKey: string) => Set<string>;
}

export const useShoppingCheckedStore = create<ShoppingCheckedStore>()(
  persist(
    (set, get) => ({
      checkedIds: [],
      weekKey: '',

      check: (id, currentWeekKey) =>
        set((s) => {
          const base = s.weekKey === currentWeekKey ? s.checkedIds : [];
          if (base.includes(id)) return {};
          return { checkedIds: [...base, id], weekKey: currentWeekKey };
        }),

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

      getChecked: (currentWeekKey) => {
        const { checkedIds, weekKey } = get();
        if (weekKey !== currentWeekKey) return new Set<string>();
        return new Set(checkedIds);
      },
    }),
    {
      name: 'shopping-checked-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
