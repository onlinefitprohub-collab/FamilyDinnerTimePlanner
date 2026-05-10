import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { Supermarket } from '../types';

// Refresh prices at most once every 3.5 days (≈ twice a week)
const SYNC_INTERVAL_MS = 3.5 * 24 * 60 * 60 * 1000;

interface PriceRow {
  ingredient_id: string;
  supermarket: Supermarket;
  price_per_unit: number;
}

interface PriceState {
  overrides: Record<string, number>; // key: `${ingredientId}::${supermarket}`
  lastSyncedAt: number | null;
  sync: () => Promise<void>;
  getPriceOverrides: () => Map<string, number>;
}

export const usePriceStore = create<PriceState>()(
  persist(
    (set, get) => ({
      overrides: {},
      lastSyncedAt: null,

      sync: async () => {
        const { lastSyncedAt } = get();
        if (lastSyncedAt && Date.now() - lastSyncedAt < SYNC_INTERVAL_MS) return;

        try {
          const { data, error } = await supabase
            .from('ingredient_prices')
            .select('ingredient_id, supermarket, price_per_unit');

          if (error || !data || data.length === 0) return;

          const overrides: Record<string, number> = {};
          for (const row of data as PriceRow[]) {
            overrides[`${row.ingredient_id}::${row.supermarket}`] = row.price_per_unit;
          }
          set({ overrides, lastSyncedAt: Date.now() });
        } catch {
          // Offline or table doesn't exist yet — leave existing overrides intact
        }
      },

      getPriceOverrides: () => {
        return new Map(Object.entries(get().overrides));
      },
    }),
    {
      name: 'price-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        overrides: state.overrides,
        lastSyncedAt: state.lastSyncedAt,
      }),
    },
  ),
);
