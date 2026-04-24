import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BudgetSettings } from '../types';
import { supabase } from '../lib/supabase';
import { fetchBudgetSettings, upsertBudgetSettings } from '../services/supabaseService';

interface BudgetState {
  weeklyBudget: number;
  isLoading: boolean;
  setWeeklyBudget: (amount: number, userId?: string) => Promise<void>;
  syncFromSupabase: (userId: string) => Promise<void>;
}

export const useBudgetStore = create<BudgetState>()(
  persist(
    (set) => ({
      weeklyBudget: 60,
      isLoading: false,

      setWeeklyBudget: async (amount: number, userId?: string) => {
        set({ weeklyBudget: amount });

        if (!userId) {
          // Try to get userId from current session if not supplied
          const { data: sessionData } = await supabase.auth.getSession();
          const id = sessionData.session?.user?.id;
          if (!id) return;

          const settings: BudgetSettings = { userId: id, weeklyBudget: amount };
          try {
            await upsertBudgetSettings(settings);
          } catch (error) {
            console.error('[BudgetStore] setWeeklyBudget error:', error);
          }
          return;
        }

        const settings: BudgetSettings = { userId, weeklyBudget: amount };
        try {
          await upsertBudgetSettings(settings);
        } catch (error) {
          console.error('[BudgetStore] setWeeklyBudget error:', error);
        }
      },

      syncFromSupabase: async (userId: string) => {
        set({ isLoading: true });
        try {
          const settings = await fetchBudgetSettings(userId);
          if (settings) {
            set({ weeklyBudget: settings.weeklyBudget });
          }
        } catch (error) {
          console.error('[BudgetStore] syncFromSupabase error:', error);
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'budget-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        weeklyBudget: state.weeklyBudget,
      }),
    },
  ),
);
