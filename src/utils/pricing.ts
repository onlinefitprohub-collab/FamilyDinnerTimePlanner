import { AnyRecipe, Ingredient, ShoppingListItem, Supermarket, IngredientCategory } from '../types';
import { getIngredientById } from '../data/ingredients';

export function scaleQuantity(baseQuantity: number, familySize: number): number {
  return Math.ceil((baseQuantity * familySize) / 4);
}

export function getCheapestOption(
  ingredientId: string,
): { supermarket: Supermarket; price: number; unitLabel: string } | null {
  const ingredient = getIngredientById(ingredientId);
  if (!ingredient || ingredient.prices.length === 0) return null;
  let cheapest = ingredient.prices[0];
  for (const p of ingredient.prices) {
    if (p.pricePerUnit < cheapest.pricePerUnit) cheapest = p;
  }
  return { supermarket: cheapest.supermarket, price: cheapest.pricePerUnit, unitLabel: cheapest.unitLabel };
}

/**
 * Calculate the cheapest total cost for a recipe at a given family size.
 */
export function calculateRecipeCost(
  recipe: AnyRecipe,
  allIngredients: Ingredient[],
  familySize: number,
): number {
  const scale = familySize / 4;
  const ingredientMap = new Map<string, Ingredient>(allIngredients.map((i) => [i.id, i]));

  let total = 0;
  for (const ri of recipe.ingredients) {
    const ingredient = ingredientMap.get(ri.ingredientId);
    if (!ingredient) continue;

    const cheapest = ingredient.prices.reduce<number | null>((min, p) => {
      return min === null || p.pricePerUnit < min ? p.pricePerUnit : min;
    }, null);

    if (cheapest !== null) {
      const scaledQty = ri.quantityPer4 * scale;
      const baseQty = ingredient.baseQuantityPer4;
      total += cheapest * (scaledQty / baseQty);
    }
  }

  return total;
}

function pickPrice(
  ingredient: Ingredient,
  preferred: Supermarket | null,
  priceOverrides?: Map<string, number>,
): { supermarket: Supermarket; price: number; unitLabel: string } {
  const effectivePrices = ingredient.prices.map((p) => {
    const key = `${ingredient.id}::${p.supermarket}`;
    return { ...p, pricePerUnit: priceOverrides?.get(key) ?? p.pricePerUnit };
  });

  if (preferred) {
    const match = effectivePrices.find((p) => p.supermarket === preferred);
    if (match) return { supermarket: match.supermarket, price: match.pricePerUnit, unitLabel: match.unitLabel };
  }
  // fallback: cheapest
  let best = effectivePrices[0];
  for (const p of effectivePrices) {
    if (p.pricePerUnit < best.pricePerUnit) best = p;
  }
  return { supermarket: best.supermarket, price: best.pricePerUnit, unitLabel: best.unitLabel };
}

function getAllPrices(
  ingredient: Ingredient,
  quantityRatio: number,
  priceOverrides?: Map<string, number>,
): { supermarket: Supermarket; price: number; unitLabel: string }[] {
  return ingredient.prices
    .map((p) => {
      const key = `${ingredient.id}::${p.supermarket}`;
      const perUnit = priceOverrides?.get(key) ?? p.pricePerUnit;
      return { supermarket: p.supermarket, price: perUnit * quantityRatio, unitLabel: p.unitLabel };
    })
    .sort((a, b) => a.price - b.price);
}

/**
 * Build a shopping list from a set of week recipes.
 * If pantryIngredientIds is provided, those ingredients are deducted.
 */
export function buildShoppingList(
  recipes: AnyRecipe[],
  allIngredients: Ingredient[],
  familySize: number,
  pantryIngredientIds?: Set<string>,
  preferredSupermarket?: Supermarket | null,
  priceOverrides?: Map<string, number>,
): ShoppingListItem[] {
  const scale = familySize / 4;
  const ingredientMap = new Map<string, Ingredient>(allIngredients.map((i) => [i.id, i]));

  // Accumulate quantities by ingredient id
  const accumulated = new Map<
    string,
    { totalQuantity: number; fromRecipes: string[] }
  >();

  for (const recipe of recipes) {
    for (const ri of recipe.ingredients) {
      const existing = accumulated.get(ri.ingredientId);
      const qty = ri.quantityPer4 * scale;
      if (existing) {
        existing.totalQuantity += qty;
        if (!existing.fromRecipes.includes(recipe.name)) {
          existing.fromRecipes.push(recipe.name);
        }
      } else {
        accumulated.set(ri.ingredientId, {
          totalQuantity: qty,
          fromRecipes: [recipe.name],
        });
      }
    }
  }

  const items: ShoppingListItem[] = [];

  for (const [ingredientId, acc] of accumulated) {
    // Skip pantry items if deduction is enabled
    if (pantryIngredientIds?.has(ingredientId)) continue;

    const ingredient = ingredientMap.get(ingredientId);
    if (!ingredient) continue;

    const quantityRatio = acc.totalQuantity / ingredient.baseQuantityPer4;
    const picked = pickPrice(ingredient, preferredSupermarket ?? null, priceOverrides);
    const scaledPrice = picked.price * quantityRatio;

    items.push({
      ingredientId,
      ingredientName: ingredient.name,
      totalQuantity: Math.ceil(acc.totalQuantity),
      unit: ingredient.unitType,
      category: ingredient.category as IngredientCategory,
      cheapestSupermarket: picked.supermarket,
      cheapestPrice: scaledPrice,
      unitLabel: picked.unitLabel,
      allPrices: getAllPrices(ingredient, quantityRatio, priceOverrides),
      allergens: ingredient.allergens,
      fromRecipes: acc.fromRecipes,
      checked: false,
    });
  }

  return items;
}

/**
 * Score a recipe by how many pantry items match its ingredients.
 */
export function scoreRecipeByPantry(
  recipe: AnyRecipe,
  allIngredients: Ingredient[],
  pantryIngredientIds: Set<string>,
  familySize: number,
): {
  recipe: AnyRecipe;
  coveredCount: number;
  totalCount: number;
  coveragePercent: number;
  missingCost: number;
} {
  const ingredientMap = new Map<string, Ingredient>(allIngredients.map((i) => [i.id, i]));
  const scale = familySize / 4;

  let coveredCount = 0;
  let missingCost = 0;

  for (const ri of recipe.ingredients) {
    if (pantryIngredientIds.has(ri.ingredientId)) {
      coveredCount++;
    } else {
      const ingredient = ingredientMap.get(ri.ingredientId);
      if (ingredient) {
        const cheapest = ingredient.prices.reduce<number>(
          (min, p) => (p.pricePerUnit < min ? p.pricePerUnit : min),
          ingredient.prices[0]?.pricePerUnit ?? 0,
        );
        missingCost += cheapest * ((ri.quantityPer4 * scale) / ingredient.baseQuantityPer4);
      }
    }
  }

  const totalCount = recipe.ingredients.length;
  const coveragePercent = totalCount > 0 ? (coveredCount / totalCount) * 100 : 0;

  return { recipe, coveredCount, totalCount, coveragePercent, missingCost };
}
