import { AnyRecipe, WeeklyMealPlan, WeeklyNutrition } from '../types';

/**
 * Calculates weekly nutrition totals from a meal plan and recipe library.
 */
export function calculateWeeklyNutrition(
  plan: WeeklyMealPlan | undefined,
  allRecipes: AnyRecipe[],
  familySize: number,
): WeeklyNutrition {
  if (!plan) {
    return {
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      avgDailyCalories: 0,
      perDayCalories: [],
    };
  }

  const dayKeys: Array<keyof Omit<WeeklyMealPlan, 'id' | 'userId' | 'weekKey'>> = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];

  const recipeMap = new Map<string, AnyRecipe>(allRecipes.map((r) => [r.id, r]));
  const scale = familySize / 4;

  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  const perDayCalories: { day: string; calories: number }[] = [];

  for (const day of dayKeys) {
    const recipeId = plan[day];
    if (!recipeId) {
      perDayCalories.push({ day, calories: 0 });
      continue;
    }

    const recipe = recipeMap.get(recipeId);
    if (!recipe?.nutritionPer4) {
      perDayCalories.push({ day, calories: 0 });
      continue;
    }

    const dayCals = Math.round(recipe.nutritionPer4.calories * scale);
    totalCalories += dayCals;
    totalProtein += Math.round(recipe.nutritionPer4.protein * scale);
    totalCarbs += Math.round(recipe.nutritionPer4.carbs * scale);
    totalFat += Math.round(recipe.nutritionPer4.fat * scale);
    perDayCalories.push({ day, calories: dayCals });
  }

  const daysWithMeals = perDayCalories.filter((d) => d.calories > 0).length;
  const avgDailyCalories =
    daysWithMeals > 0 ? Math.round(totalCalories / daysWithMeals) : 0;

  return {
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFat,
    avgDailyCalories,
    perDayCalories,
  };
}
