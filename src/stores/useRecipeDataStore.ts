import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImportedRecipe, CustomRecipe } from '../types';
import { supabase } from '../lib/supabase';
import {
  fetchImportedRecipes,
  insertImportedRecipe,
  deleteImportedRecipe as deleteImportedRecipeService,
  fetchCustomRecipes,
  insertCustomRecipe,
  updateCustomRecipe as updateCustomRecipeService,
  deleteCustomRecipe as deleteCustomRecipeService,
} from '../services/supabaseService';

interface RecipeDataState {
  importedRecipes: ImportedRecipe[];
  customRecipes: CustomRecipe[];
  isLoading: boolean;
  addImportedRecipe: (recipe: Omit<ImportedRecipe, 'id'>) => Promise<void>;
  addCustomRecipe: (recipe: Omit<CustomRecipe, 'id'>) => Promise<void>;
  updateCustomRecipe: (id: string, updates: Partial<CustomRecipe>) => Promise<void>;
  deleteCustomRecipe: (id: string) => Promise<void>;
  deleteImportedRecipe: (id: string) => Promise<void>;
  syncFromSupabase: () => Promise<void>;
}

export const useRecipeDataStore = create<RecipeDataState>()(
  persist(
    (set, get) => ({
      importedRecipes: [],
      customRecipes: [],
      isLoading: false,

      addImportedRecipe: async (recipe: Omit<ImportedRecipe, 'id'>) => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

        const full: ImportedRecipe = {
          ...recipe,
          id: `imported-${recipe.externalId}-${Date.now()}`,
          userId,
        };

        set((state) => ({ importedRecipes: [...state.importedRecipes, full] }));
        try {
          await insertImportedRecipe(full);
        } catch (error) {
          console.error('[RecipeDataStore] addImportedRecipe error:', error);
          set((state) => ({
            importedRecipes: state.importedRecipes.filter((r) => r.id !== full.id),
          }));
        }
      },

      addCustomRecipe: async (recipe: Omit<CustomRecipe, 'id'>) => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

        const full: CustomRecipe = {
          ...recipe,
          id: `custom-${Date.now()}`,
          userId,
        };

        set((state) => ({ customRecipes: [...state.customRecipes, full] }));
        try {
          await insertCustomRecipe(full);
        } catch (error) {
          console.error('[RecipeDataStore] addCustomRecipe error:', error);
          set((state) => ({
            customRecipes: state.customRecipes.filter((r) => r.id !== full.id),
          }));
        }
      },

      updateCustomRecipe: async (id: string, updates: Partial<CustomRecipe>) => {
        const previous = get().customRecipes;
        const existing = previous.find((r) => r.id === id);
        if (!existing) return;
        const merged = { ...existing, ...updates };
        set((state) => ({
          customRecipes: state.customRecipes.map((r) => (r.id === id ? merged : r)),
        }));
        try {
          await updateCustomRecipeService(id, merged);
        } catch (error) {
          console.error('[RecipeDataStore] updateCustomRecipe error:', error);
          set({ customRecipes: previous });
        }
      },

      deleteCustomRecipe: async (id: string) => {
        const previous = get().customRecipes;
        set((state) => ({ customRecipes: state.customRecipes.filter((r) => r.id !== id) }));
        try {
          await deleteCustomRecipeService(id);
        } catch (error) {
          console.error('[RecipeDataStore] deleteCustomRecipe error:', error);
          set({ customRecipes: previous });
        }
      },

      deleteImportedRecipe: async (id: string) => {
        const previous = get().importedRecipes;
        set((state) => ({ importedRecipes: state.importedRecipes.filter((r) => r.id !== id) }));
        try {
          await deleteImportedRecipeService(id);
        } catch (error) {
          console.error('[RecipeDataStore] deleteImportedRecipe error:', error);
          set({ importedRecipes: previous });
        }
      },

      syncFromSupabase: async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

        set({ isLoading: true });
        try {
          const [imported, custom] = await Promise.all([
            fetchImportedRecipes(userId),
            fetchCustomRecipes(userId),
          ]);
          set({ importedRecipes: imported, customRecipes: custom });
        } catch (error) {
          console.error('[RecipeDataStore] syncFromSupabase error:', error);
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'recipe-data-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
