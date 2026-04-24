import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WeeklyMealPlan } from '../types';
import { supabase } from '../lib/supabase';
import { fetchMealPlan, upsertMealPlan } from '../services/supabaseService';

type MealDay = keyof Omit<WeeklyMealPlan, 'id' | 'userId' | 'weekKey'>;

interface MealPlanState {
  plans: Record<string, WeeklyMealPlan>;
  currentWeekKey: string;
  isLoading: boolean;
  setMeal: (weekKey: string, day: MealDay, recipeId: string | null) => void;
  removeMeal: (weekKey: string, day: string) => void;
  loadWeek: (weekKey: string) => Promise<void>;
  saveWeek: (weekKey: string) => Promise<void>;
  syncFromSupabase: () => Promise<void>;
  subscribeToRealtime: (userId: string) => () => void;
  getCurrentWeekKey: () => string;
}

function computeISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export const useMealPlanStore = create<MealPlanState>()(
  persist(
    (set, get) => ({
      plans: {},
      currentWeekKey: computeISOWeekKey(new Date()),
      isLoading: false,

      getCurrentWeekKey: () => computeISOWeekKey(new Date()),

      setMeal: (weekKey, day, recipeId) => {
        set((state) => {
          const existing = state.plans[weekKey] ?? {
            userId: '',
            weekKey,
          };
          const updated: WeeklyMealPlan = {
            ...existing,
            [day]: recipeId ?? undefined,
          };
          return {
            plans: { ...state.plans, [weekKey]: updated },
          };
        });
      },

      removeMeal: (weekKey, day) => {
        set((state) => {
          const existing = state.plans[weekKey];
          if (!existing) return state;
          const updated = { ...existing } as WeeklyMealPlan & Record<string, unknown>;
          delete updated[day];
          return { plans: { ...state.plans, [weekKey]: updated as WeeklyMealPlan } };
        });
      },

      loadWeek: async (weekKey) => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

        set({ isLoading: true });
        try {
          const plan = await fetchMealPlan(userId, weekKey);
          if (plan) {
            set((state) => ({
              plans: { ...state.plans, [weekKey]: plan },
            }));
          }
        } catch (error) {
          console.error('[MealPlanStore] loadWeek error:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      saveWeek: async (weekKey) => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

        const plan = get().plans[weekKey];
        if (!plan) return;

        set({ isLoading: true });
        try {
          await upsertMealPlan({ ...plan, userId });
        } catch (error) {
          console.error('[MealPlanStore] saveWeek error:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      syncFromSupabase: async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

        const weekKey = computeISOWeekKey(new Date());
        set({ isLoading: true, currentWeekKey: weekKey });
        try {
          const plan = await fetchMealPlan(userId, weekKey);
          if (plan) {
            set((state) => ({
              plans: { ...state.plans, [weekKey]: plan },
            }));
          }
        } catch (error) {
          console.error('[MealPlanStore] syncFromSupabase error:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      subscribeToRealtime: (userId: string) => {
        const channel = supabase
          .channel(`meal_plans:${userId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'meal_plans',
              filter: `user_id=eq.${userId}`,
            },
            (payload) => {
              const row = payload.new as Record<string, unknown>;
              if (!row || !row['week_key']) return;
              const plan: WeeklyMealPlan = {
                id: row['id'] as string | undefined,
                userId: row['user_id'] as string,
                weekKey: row['week_key'] as string,
                monday: row['monday'] as string | undefined,
                tuesday: row['tuesday'] as string | undefined,
                wednesday: row['wednesday'] as string | undefined,
                thursday: row['thursday'] as string | undefined,
                friday: row['friday'] as string | undefined,
                saturday: row['saturday'] as string | undefined,
                sunday: row['sunday'] as string | undefined,
              };
              set((state) => ({
                plans: { ...state.plans, [plan.weekKey]: plan },
              }));
            },
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      },
    }),
    {
      name: 'meal-plan-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
