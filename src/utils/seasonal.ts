import { getActiveDeals } from '../data/deals';
import { isIngredientInSeason } from '../data/seasonal';
import { Recipe, Deal } from '../types';

/** Returns all active deals for any ingredient used in the recipe. */
export function getActiveDealsForRecipe(recipe: Recipe): Deal[] {
  const activeDeals = getActiveDeals();
  const ingredientIds = new Set(recipe.ingredients.map((i) => i.ingredientId));
  return activeDeals.filter((deal) => ingredientIds.has(deal.ingredientId));
}

/** Returns true if any ingredient in the recipe is in season this month. */
export function isRecipeInSeason(recipe: Recipe, month?: number): boolean {
  const currentMonth = month ?? new Date().getMonth() + 1;
  return recipe.ingredients.some((ing) =>
    isIngredientInSeason(ing.ingredientId, currentMonth),
  );
}

/** Filters recipes to only those with at least one in-season ingredient. */
export function getSeasonalRecipes(recipes: Recipe[], month?: number): Recipe[] {
  return recipes.filter((r) => isRecipeInSeason(r, month));
}
