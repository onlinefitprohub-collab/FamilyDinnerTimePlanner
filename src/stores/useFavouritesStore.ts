import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import {
  fetchUserRecipeData,
  upsertUserRecipeData,
} from '../services/supabaseService';

interface FavouritesState {
  favourites: Record<string, boolean>;
  ratings: Record<string, number>;
  toggleFavourite: (recipeId: string) => Promise<void>;
  setRating: (recipeId: string, rating: number) => Promise<void>;
  syncFromSupabase: () => Promise<void>;
  subscribeToRealtime: (userId: string) => () => void;
}

export const useFavouritesStore = create<FavouritesState>()(
  persist(
    (set, get) => ({
      favourites: {},
      ratings: {},

      toggleFavourite: async (recipeId: string) => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

        const current = get().favourites[recipeId] ?? false;
        const next = !current;

        set((state) => ({
          favourites: { ...state.favourites, [recipeId]: next },
        }));

        try {
          const rating = get().ratings[recipeId] ?? null;
          await upsertUserRecipeData(userId, recipeId, next, rating);
        } catch (error) {
          console.error('[FavouritesStore] toggleFavourite error:', error);
          set((state) => ({
            favourites: { ...state.favourites, [recipeId]: current },
          }));
        }
      },

      setRating: async (recipeId: string, rating: number) => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

        const previousRating = get().ratings[recipeId];
        set((state) => ({
          ratings: { ...state.ratings, [recipeId]: rating },
        }));

        try {
          const isFavourite = get().favourites[recipeId] ?? false;
          await upsertUserRecipeData(userId, recipeId, isFavourite, rating);
        } catch (error) {
          console.error('[FavouritesStore] setRating error:', error);
          set((state) => {
            const next = { ...state.ratings };
            if (previousRating !== undefined) {
              next[recipeId] = previousRating;
            } else {
              delete next[recipeId];
            }
            return { ratings: next };
          });
        }
      },

      syncFromSupabase: async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

        try {
          const rows = await fetchUserRecipeData(userId);
          const favourites: Record<string, boolean> = {};
          const ratings: Record<string, number> = {};

          for (const row of rows) {
            favourites[row.recipeId] = row.isFavourite;
            if (row.rating !== null) {
              ratings[row.recipeId] = row.rating;
            }
          }

          set({ favourites, ratings });
        } catch (error) {
          console.error('[FavouritesStore] syncFromSupabase error:', error);
        }
      },

      subscribeToRealtime: (userId: string) => {
        const channel = supabase
          .channel(`user_recipe_data:${userId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'user_recipe_data',
              filter: `user_id=eq.${userId}`,
            },
            async () => {
              try {
                const rows = await fetchUserRecipeData(userId);
                const favourites: Record<string, boolean> = {};
                const ratings: Record<string, number> = {};

                for (const row of rows) {
                  favourites[row.recipeId] = row.isFavourite;
                  if (row.rating !== null) {
                    ratings[row.recipeId] = row.rating;
                  }
                }

                set({ favourites, ratings });
              } catch (error) {
                console.error('[FavouritesStore] realtime sync error:', error);
              }
            },
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      },
    }),
    {
      name: 'favourites-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
