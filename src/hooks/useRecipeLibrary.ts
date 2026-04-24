import { useMemo } from 'react';
import { recipes as builtinRecipes } from '../data/recipes';
import { useRecipeDataStore } from '../stores/useRecipeDataStore';
import { AnyRecipe } from '../types';

export function useRecipeLibrary() {
  const importedRecipes = useRecipeDataStore((s) => s.importedRecipes);
  const customRecipes = useRecipeDataStore((s) => s.customRecipes);
  const isLoading = useRecipeDataStore((s) => s.isLoading);

  const recipes = useMemo<AnyRecipe[]>(() => {
    return [...builtinRecipes, ...importedRecipes, ...customRecipes];
  }, [importedRecipes, customRecipes]);

  const getRecipeById = useMemo(() => {
    return (id: string): AnyRecipe | undefined => {
      return recipes.find((r) => r.id === id);
    };
  }, [recipes]);

  return { recipes, getRecipeById, isLoading };
}
