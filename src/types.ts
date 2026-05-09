export type Allergen =
  | 'celery'
  | 'gluten'
  | 'crustaceans'
  | 'eggs'
  | 'fish'
  | 'lupin'
  | 'milk'
  | 'molluscs'
  | 'mustard'
  | 'peanuts'
  | 'sesame'
  | 'soybeans'
  | 'sulphites'
  | 'tree-nuts';

export type Supermarket =
  | 'Tesco'
  | "Sainsbury's"
  | 'Asda'
  | 'Morrisons'
  | 'Lidl'
  | 'Aldi';

export type IngredientCategory =
  | 'meat'
  | 'dairy'
  | 'vegetables'
  | 'pasta-rice'
  | 'canned'
  | 'spices'
  | 'bakery'
  | 'frozen'
  | 'condiments'
  | 'ready-meals'
  | 'other';

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  unitType: 'g' | 'ml' | 'item' | 'tbsp' | 'tsp';
  baseQuantityPer4: number;
  allergens: Allergen[];
  prices: {
    supermarket: Supermarket;
    pricePerUnit: number;
    unitLabel: string;
  }[];
}

export type RecipeCategory =
  | 'pasta'
  | 'roast'
  | 'curry'
  | 'soup'
  | 'pie'
  | 'stir-fry'
  | 'bake'
  | 'grill'
  | 'ready-meal'
  | 'pizza'
  | 'takeaway';

export interface RecipeIngredient {
  ingredientId: string;
  quantityPer4: number;
  unit: string;
  notes?: string;
}

export interface RecipeStep {
  stepNumber: number;
  instruction: string;
  duration?: number;
  tip?: string;
}

export interface NutritionPer4 {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DietaryInfo {
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  dairyFree: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  category: RecipeCategory;
  tags: string[];
  servesBase: 4;
  prepTime: number;
  cookTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  image: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  nutritionPer4: NutritionPer4 | null;
  tips?: string[];
  dietaryInfo: DietaryInfo;
  allergens: Allergen[];
  freezerFriendly: boolean;
  batchCookNotes?: string;
  onePot: boolean;
  kidFriendly: boolean;
}

export interface ImportedRecipe extends Recipe {
  source: 'themealdb' | 'spoonacular' | 'edamam';
  externalId: string;
  importedAt: string;
  userId: string;
}

export interface CustomRecipe extends Recipe {
  source: 'custom';
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export type AnyRecipe = Recipe | ImportedRecipe | CustomRecipe;

export interface Deal {
  ingredientId: string;
  supermarket: Supermarket;
  originalPrice: number;
  dealPrice: number;
  dealLabel: string;
  validUntil: string;
}

export interface FamilyMember {
  id: string;
  userId: string;
  name: string;
  avatarEmoji: string;
  avatarPhoto?: string;
  allergens: Allergen[];
  dislikes: string[];
  dietType: 'none' | 'vegetarian' | 'vegan' | 'gluten-free' | 'dairy-free';
}

export interface MealPlanTemplate {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
  days: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };
}

export interface FreezerItem {
  id: string;
  userId: string;
  label: string;
  type: 'meal' | 'ingredient';
  recipeId?: string;
  ingredientId?: string;
  portions?: number;
  quantity?: number;
  frozenAt: string;
  useByDate?: string;
}

export interface PantryItem {
  id: string;
  userId: string;
  ingredientId: string;
  inStock: boolean;
  quantity: number;
  isLowStock: boolean;
}

export interface WeeklyMealPlan {
  id?: string;
  userId: string;
  weekKey: string;
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
}

export interface ShoppingListItem {
  ingredientId: string;
  ingredientName: string;
  totalQuantity: number;
  unit: string;
  category: IngredientCategory;
  cheapestSupermarket: Supermarket;
  cheapestPrice: number;
  unitLabel: string;
  allergens: Allergen[];
  fromRecipes: string[];
  checked: boolean;
  isAdHoc?: boolean;
  isFreezerItem?: boolean;
}

export interface IngredientCostRow {
  ingredientId: string;
  ingredientName: string;
  scaledQuantity: number;
  unit: string;
  cheapestSupermarket: Supermarket;
  cheapestPrice: number;
  allPrices: { supermarket: Supermarket; price: number; unitLabel: string }[];
  inPantry: boolean;
  onOffer: boolean;
  dealLabel?: string;
  dealSaving?: number;
  allergens: Allergen[];
}

export interface AllergenConflict {
  memberId: string;
  memberName: string;
  conflictType: 'allergen' | 'dislike';
  allergens: Allergen[];
  dislikes: string[];
}

export interface UserProfile {
  userId: string;
  familyName: string;
  familySize: number;
  preferredSupermarket?: Supermarket;
}

export interface BudgetSettings {
  userId: string;
  weeklyBudget: number;
}

export interface ScanHistoryEntry {
  id: string;
  userId: string;
  barcode: string;
  productName: string;
  matchedIngredientId?: string;
  scannedAt: string;
  action: string;
}

export interface BarcodeCacheEntry {
  barcode: string;
  productName: string;
  matchedIngredientId?: string;
  cachedAt: string;
}

export interface WeeklyNutrition {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  avgDailyCalories: number;
  perDayCalories: { day: string; calories: number }[];
}

export type RecipeSource = 'builtin' | 'imported' | 'custom';
