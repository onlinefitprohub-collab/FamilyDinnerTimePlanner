// IMPORTANT: API keys are stored in expo-secure-store ONLY.
// NEVER hardcode keys here. NEVER transmit keys to any server other than the chosen provider.

export interface ExternalRecipe {
  externalId: string;
  name: string;
  category: string;
  area?: string;
  instructions: string;
  image: string;
  ingredients: { name: string; measure: string }[];
  source?: string;
}

export interface RecipeApiService {
  searchByName(query: string): Promise<ExternalRecipe[]>;
  browseByCategory(category: string): Promise<ExternalRecipe[]>;
  getRandom(): Promise<ExternalRecipe | null>;
  getById(id: string): Promise<ExternalRecipe | null>;
  getCategories(): Promise<string[]>;
  testConnection(): Promise<boolean>;
}

// ─── TheMealDB response types ────────────────────────────────────────────────

interface MealDBMeal {
  idMeal: string;
  strMeal: string;
  strCategory: string;
  strArea: string | null;
  strInstructions: string;
  strMealThumb: string;
  strSource: string | null;
  strIngredient1?: string | null;
  strIngredient2?: string | null;
  strIngredient3?: string | null;
  strIngredient4?: string | null;
  strIngredient5?: string | null;
  strIngredient6?: string | null;
  strIngredient7?: string | null;
  strIngredient8?: string | null;
  strIngredient9?: string | null;
  strIngredient10?: string | null;
  strIngredient11?: string | null;
  strIngredient12?: string | null;
  strIngredient13?: string | null;
  strIngredient14?: string | null;
  strIngredient15?: string | null;
  strIngredient16?: string | null;
  strIngredient17?: string | null;
  strIngredient18?: string | null;
  strIngredient19?: string | null;
  strIngredient20?: string | null;
  strMeasure1?: string | null;
  strMeasure2?: string | null;
  strMeasure3?: string | null;
  strMeasure4?: string | null;
  strMeasure5?: string | null;
  strMeasure6?: string | null;
  strMeasure7?: string | null;
  strMeasure8?: string | null;
  strMeasure9?: string | null;
  strMeasure10?: string | null;
  strMeasure11?: string | null;
  strMeasure12?: string | null;
  strMeasure13?: string | null;
  strMeasure14?: string | null;
  strMeasure15?: string | null;
  strMeasure16?: string | null;
  strMeasure17?: string | null;
  strMeasure18?: string | null;
  strMeasure19?: string | null;
  strMeasure20?: string | null;
}

interface MealDBResponse {
  meals: MealDBMeal[] | null;
}

interface MealDBCategoryItem {
  strCategory: string;
}

interface MealDBCategoriesResponse {
  meals: MealDBCategoryItem[] | null;
}

function mapMealToExternal(meal: MealDBMeal): ExternalRecipe {
  const ingredients: { name: string; measure: string }[] = [];

  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}` as keyof MealDBMeal] as string | null | undefined;
    const measure = meal[`strMeasure${i}` as keyof MealDBMeal] as string | null | undefined;

    if (name && name.trim()) {
      ingredients.push({
        name: name.trim(),
        measure: (measure ?? '').trim(),
      });
    }
  }

  return {
    externalId: meal.idMeal,
    name: meal.strMeal,
    category: meal.strCategory,
    area: meal.strArea ?? undefined,
    instructions: meal.strInstructions,
    image: meal.strMealThumb,
    ingredients,
    source: meal.strSource ?? undefined,
  };
}

// ─── TheMealDB Service ───────────────────────────────────────────────────────

export class TheMealDBService implements RecipeApiService {
  private readonly BASE_URL = 'https://www.themealdb.com/api/json/v1/1';

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.BASE_URL}${path}`);
    if (!response.ok) {
      throw new Error(`TheMealDB request failed: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  async searchByName(query: string): Promise<ExternalRecipe[]> {
    try {
      const data = await this.get<MealDBResponse>(`/search.php?s=${encodeURIComponent(query)}`);
      if (!data.meals) return [];
      return data.meals.map(mapMealToExternal);
    } catch (error) {
      console.error('[TheMealDBService] searchByName error:', error);
      return [];
    }
  }

  async browseByCategory(category: string): Promise<ExternalRecipe[]> {
    try {
      // Filter endpoint returns summary only (no ingredients/instructions)
      // so we fetch each meal individually for full data
      const filterData = await this.get<{ meals: { idMeal: string }[] | null }>(
        `/filter.php?c=${encodeURIComponent(category)}`,
      );
      if (!filterData.meals) return [];

      // Limit to first 20 to avoid too many requests
      const ids = filterData.meals.slice(0, 20).map((m) => m.idMeal);
      const results = await Promise.all(ids.map((id) => this.getById(id)));
      return results.filter((r): r is ExternalRecipe => r !== null);
    } catch (error) {
      console.error('[TheMealDBService] browseByCategory error:', error);
      return [];
    }
  }

  async getRandom(): Promise<ExternalRecipe | null> {
    try {
      const data = await this.get<MealDBResponse>('/random.php');
      if (!data.meals || data.meals.length === 0) return null;
      return mapMealToExternal(data.meals[0]);
    } catch (error) {
      console.error('[TheMealDBService] getRandom error:', error);
      return null;
    }
  }

  async getById(id: string): Promise<ExternalRecipe | null> {
    try {
      const data = await this.get<MealDBResponse>(`/lookup.php?i=${encodeURIComponent(id)}`);
      if (!data.meals || data.meals.length === 0) return null;
      return mapMealToExternal(data.meals[0]);
    } catch (error) {
      console.error('[TheMealDBService] getById error:', error);
      return null;
    }
  }

  async getCategories(): Promise<string[]> {
    try {
      const data = await this.get<MealDBCategoriesResponse>('/list.php?c=list');
      if (!data.meals) return [];
      return data.meals.map((c) => c.strCategory);
    } catch (error) {
      console.error('[TheMealDBService] getCategories error:', error);
      return [];
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const data = await this.get<MealDBResponse>('/random.php');
      return Array.isArray(data.meals) && data.meals.length > 0;
    } catch {
      return false;
    }
  }
}

// ─── Spoonacular Service (stub) ───────────────────────────────────────────────

export class SpoonacularService implements RecipeApiService {
  async searchByName(_query: string): Promise<ExternalRecipe[]> {
    console.warn('[SpoonacularService] Spoonacular not configured');
    return [];
  }

  async browseByCategory(_category: string): Promise<ExternalRecipe[]> {
    console.warn('[SpoonacularService] Spoonacular not configured');
    return [];
  }

  async getRandom(): Promise<ExternalRecipe | null> {
    console.warn('[SpoonacularService] Spoonacular not configured');
    return null;
  }

  async getById(_id: string): Promise<ExternalRecipe | null> {
    console.warn('[SpoonacularService] Spoonacular not configured');
    return null;
  }

  async getCategories(): Promise<string[]> {
    console.warn('[SpoonacularService] Spoonacular not configured');
    return [];
  }

  async testConnection(): Promise<boolean> {
    console.warn('[SpoonacularService] Spoonacular not configured');
    return false;
  }
}

// ─── Edamam Service (stub) ────────────────────────────────────────────────────

export class EdamamService implements RecipeApiService {
  async searchByName(_query: string): Promise<ExternalRecipe[]> {
    console.warn('[EdamamService] Edamam not configured');
    return [];
  }

  async browseByCategory(_category: string): Promise<ExternalRecipe[]> {
    console.warn('[EdamamService] Edamam not configured');
    return [];
  }

  async getRandom(): Promise<ExternalRecipe | null> {
    console.warn('[EdamamService] Edamam not configured');
    return null;
  }

  async getById(_id: string): Promise<ExternalRecipe | null> {
    console.warn('[EdamamService] Edamam not configured');
    return null;
  }

  async getCategories(): Promise<string[]> {
    console.warn('[EdamamService] Edamam not configured');
    return [];
  }

  async testConnection(): Promise<boolean> {
    console.warn('[EdamamService] Edamam not configured');
    return false;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export const theMealDBService = new TheMealDBService();

/**
 * Returns the active RecipeApiService.
 * Defaults to TheMealDB (free, no key required).
 * In future, read a provider preference from SecureStore here.
 */
export async function getRecipeApiService(): Promise<RecipeApiService> {
  return theMealDBService;
}
