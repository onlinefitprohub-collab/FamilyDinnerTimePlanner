import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ShoppingExtrasState {
  extraRecipeIds: string[];
  addExtraRecipe: (recipeId: string) => void;
  removeExtraRecipe: (recipeId: string) => void;
  clearExtras: () => void;
}

export const useShoppingExtrasStore = create<ShoppingExtrasState>()(
  persist(
    (set) => ({
      extraRecipeIds: [],

      addExtraRecipe: (recipeId: string) => {
        set((state) => {
          if (state.extraRecipeIds.includes(recipeId)) return state;
          return { extraRecipeIds: [...state.extraRecipeIds, recipeId] };
        });
      },

      removeExtraRecipe: (recipeId: string) => {
        set((state) => ({
          extraRecipeIds: state.extraRecipeIds.filter((id) => id !== recipeId),
        }));
      },

      clearExtras: () => set({ extraRecipeIds: [] }),
    }),
    {
      name: 'shopping-extras-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
