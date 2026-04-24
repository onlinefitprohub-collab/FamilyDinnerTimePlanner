/**
 * UK seasonal produce by month.
 * Ingredient IDs reference src/data/ingredients.ts where available.
 * Display names are used for produce not in our ingredient database.
 */

interface SeasonalItem {
  ingredientId: string;
  name: string;
}

export const seasonalProduce: Record<number, SeasonalItem[]> = {
  1: [
    { ingredientId: 'leek', name: 'Leeks' },
    { ingredientId: 'carrot', name: 'Carrots' },
    { ingredientId: 'potato-1kg', name: 'Potatoes' },
    { ingredientId: 'celery', name: 'Celery' },
    { ingredientId: 'parsnip', name: 'Parsnips' },
    { ingredientId: 'cabbage', name: 'Savoy Cabbage' },
    { ingredientId: 'sprouts', name: 'Brussels Sprouts' },
  ],
  2: [
    { ingredientId: 'leek', name: 'Leeks' },
    { ingredientId: 'carrot', name: 'Carrots' },
    { ingredientId: 'potato-1kg', name: 'Potatoes' },
    { ingredientId: 'celery', name: 'Celery' },
    { ingredientId: 'purple-sprouting-broccoli', name: 'Purple Sprouting Broccoli' },
    { ingredientId: 'kale', name: 'Kale' },
  ],
  3: [
    { ingredientId: 'leek', name: 'Leeks' },
    { ingredientId: 'carrot', name: 'Carrots' },
    { ingredientId: 'purple-sprouting-broccoli', name: 'Purple Sprouting Broccoli' },
    { ingredientId: 'kale', name: 'Kale' },
    { ingredientId: 'spinach', name: 'Spinach' },
    { ingredientId: 'spring-onion', name: 'Spring Onions' },
  ],
  4: [
    { ingredientId: 'carrot', name: 'Carrots' },
    { ingredientId: 'leek', name: 'Leeks' },
    { ingredientId: 'asparagus', name: 'Asparagus' },
    { ingredientId: 'spinach', name: 'Spinach' },
    { ingredientId: 'spring-onion', name: 'Spring Onions' },
    { ingredientId: 'radish', name: 'Radishes' },
    { ingredientId: 'watercress', name: 'Watercress' },
  ],
  5: [
    { ingredientId: 'carrot', name: 'Carrots' },
    { ingredientId: 'asparagus', name: 'Asparagus' },
    { ingredientId: 'spinach', name: 'Spinach' },
    { ingredientId: 'spring-onion', name: 'Spring Onions' },
    { ingredientId: 'radish', name: 'Radishes' },
    { ingredientId: 'new-potatoes', name: 'New Potatoes' },
    { ingredientId: 'peas', name: 'Peas' },
  ],
  6: [
    { ingredientId: 'carrot', name: 'Carrots' },
    { ingredientId: 'asparagus', name: 'Asparagus' },
    { ingredientId: 'courgette', name: 'Courgettes' },
    { ingredientId: 'new-potatoes', name: 'New Potatoes' },
    { ingredientId: 'peas', name: 'Peas' },
    { ingredientId: 'broad-beans', name: 'Broad Beans' },
    { ingredientId: 'strawberries', name: 'Strawberries' },
    { ingredientId: 'lettuce', name: 'Lettuce' },
  ],
  7: [
    { ingredientId: 'carrot', name: 'Carrots' },
    { ingredientId: 'courgette', name: 'Courgettes' },
    { ingredientId: 'new-potatoes', name: 'New Potatoes' },
    { ingredientId: 'peas', name: 'Peas' },
    { ingredientId: 'broad-beans', name: 'Broad Beans' },
    { ingredientId: 'lettuce', name: 'Lettuce' },
    { ingredientId: 'tomato-fresh', name: 'Tomatoes' },
    { ingredientId: 'runner-beans', name: 'Runner Beans' },
    { ingredientId: 'sweetcorn', name: 'Sweetcorn' },
  ],
  8: [
    { ingredientId: 'carrot', name: 'Carrots' },
    { ingredientId: 'courgette', name: 'Courgettes' },
    { ingredientId: 'tomato-fresh', name: 'Tomatoes' },
    { ingredientId: 'sweetcorn', name: 'Sweetcorn' },
    { ingredientId: 'runner-beans', name: 'Runner Beans' },
    { ingredientId: 'lettuce', name: 'Lettuce' },
    { ingredientId: 'cucumber', name: 'Cucumber' },
    { ingredientId: 'pepper', name: 'Peppers' },
  ],
  9: [
    { ingredientId: 'carrot', name: 'Carrots' },
    { ingredientId: 'potato-1kg', name: 'Potatoes' },
    { ingredientId: 'courgette', name: 'Courgettes' },
    { ingredientId: 'tomato-fresh', name: 'Tomatoes' },
    { ingredientId: 'sweetcorn', name: 'Sweetcorn' },
    { ingredientId: 'butternut-squash', name: 'Butternut Squash' },
    { ingredientId: 'apple', name: 'Apples' },
    { ingredientId: 'blackberries', name: 'Blackberries' },
  ],
  10: [
    { ingredientId: 'potato-1kg', name: 'Potatoes' },
    { ingredientId: 'carrot', name: 'Carrots' },
    { ingredientId: 'leek', name: 'Leeks' },
    { ingredientId: 'celery', name: 'Celery' },
    { ingredientId: 'butternut-squash', name: 'Butternut Squash' },
    { ingredientId: 'parsnip', name: 'Parsnips' },
    { ingredientId: 'apple', name: 'Apples' },
    { ingredientId: 'pear', name: 'Pears' },
    { ingredientId: 'mushrooms', name: 'Wild Mushrooms' },
  ],
  11: [
    { ingredientId: 'leek', name: 'Leeks' },
    { ingredientId: 'carrot', name: 'Carrots' },
    { ingredientId: 'potato-1kg', name: 'Potatoes' },
    { ingredientId: 'celery', name: 'Celery' },
    { ingredientId: 'parsnip', name: 'Parsnips' },
    { ingredientId: 'cabbage', name: 'Savoy Cabbage' },
    { ingredientId: 'butternut-squash', name: 'Butternut Squash' },
    { ingredientId: 'sprouts', name: 'Brussels Sprouts' },
  ],
  12: [
    { ingredientId: 'leek', name: 'Leeks' },
    { ingredientId: 'carrot', name: 'Carrots' },
    { ingredientId: 'potato-1kg', name: 'Potatoes' },
    { ingredientId: 'celery', name: 'Celery' },
    { ingredientId: 'parsnip', name: 'Parsnips' },
    { ingredientId: 'cabbage', name: 'Savoy Cabbage' },
    { ingredientId: 'sprouts', name: 'Brussels Sprouts' },
    { ingredientId: 'red-cabbage', name: 'Red Cabbage' },
  ],
};

/** Returns the list of in-season ingredients for a given month (1–12). */
export function getSeasonalIngredients(month: number): SeasonalItem[] {
  return seasonalProduce[month] ?? [];
}

/** Returns true if the ingredient (by ID or name) is in season in the given month. */
export function isIngredientInSeason(ingredientId: string, month: number): boolean {
  const items = getSeasonalIngredients(month);
  return items.some((item) => item.ingredientId === ingredientId);
}
