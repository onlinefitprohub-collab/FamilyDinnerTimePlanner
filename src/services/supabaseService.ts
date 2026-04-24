import { supabase } from '../lib/supabase';
import {
  UserProfile,
  WeeklyMealPlan,
  PantryItem,
  FreezerItem,
  FamilyMember,
  BudgetSettings,
  MealPlanTemplate,
  ImportedRecipe,
  CustomRecipe,
  ScanHistoryEntry,
} from '../types';

// ─── Profile ────────────────────────────────────────────────────────────────

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, family_name, family_size')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[supabaseService] fetchProfile error:', error);
    return null;
  }
  if (!data) return null;

  return {
    userId: data.user_id as string,
    familyName: data.family_name as string,
    familySize: data.family_size as number,
  };
}

export async function upsertProfile(
  profile: Partial<UserProfile> & { userId: string },
): Promise<void> {
  const { error } = await supabase.from('profiles').upsert(
    {
      user_id: profile.userId,
      ...(profile.familyName !== undefined && { family_name: profile.familyName }),
      ...(profile.familySize !== undefined && { family_size: profile.familySize }),
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    console.error('[supabaseService] upsertProfile error:', error);
    throw error;
  }
}

// ─── Meal Plans ─────────────────────────────────────────────────────────────

export async function fetchMealPlan(
  userId: string,
  weekKey: string,
): Promise<WeeklyMealPlan | null> {
  const { data, error } = await supabase
    .from('meal_plans')
    .select(
      'id, user_id, week_key, monday, tuesday, wednesday, thursday, friday, saturday, sunday',
    )
    .eq('user_id', userId)
    .eq('week_key', weekKey)
    .maybeSingle();

  if (error) {
    console.error('[supabaseService] fetchMealPlan error:', error);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id as string | undefined,
    userId: data.user_id as string,
    weekKey: data.week_key as string,
    monday: (data.monday as string | undefined) ?? undefined,
    tuesday: (data.tuesday as string | undefined) ?? undefined,
    wednesday: (data.wednesday as string | undefined) ?? undefined,
    thursday: (data.thursday as string | undefined) ?? undefined,
    friday: (data.friday as string | undefined) ?? undefined,
    saturday: (data.saturday as string | undefined) ?? undefined,
    sunday: (data.sunday as string | undefined) ?? undefined,
  };
}

export async function upsertMealPlan(plan: WeeklyMealPlan): Promise<void> {
  const { error } = await supabase.from('meal_plans').upsert(
    {
      ...(plan.id && { id: plan.id }),
      user_id: plan.userId,
      week_key: plan.weekKey,
      monday: plan.monday ?? null,
      tuesday: plan.tuesday ?? null,
      wednesday: plan.wednesday ?? null,
      thursday: plan.thursday ?? null,
      friday: plan.friday ?? null,
      saturday: plan.saturday ?? null,
      sunday: plan.sunday ?? null,
    },
    { onConflict: 'user_id,week_key' },
  );

  if (error) {
    console.error('[supabaseService] upsertMealPlan error:', error);
    throw error;
  }
}

// ─── Pantry ──────────────────────────────────────────────────────────────────

export async function fetchPantryItems(userId: string): Promise<PantryItem[]> {
  const { data, error } = await supabase
    .from('pantry_items')
    .select('id, user_id, ingredient_id, in_stock, quantity, is_low_stock')
    .eq('user_id', userId);

  if (error) {
    console.error('[supabaseService] fetchPantryItems error:', error);
    return [];
  }
  if (!data) return [];

  return data.map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    ingredientId: row.ingredient_id as string,
    inStock: row.in_stock as boolean,
    quantity: row.quantity as number,
    isLowStock: row.is_low_stock as boolean,
  }));
}

export async function upsertPantryItem(item: PantryItem): Promise<void> {
  const { error } = await supabase.from('pantry_items').upsert(
    {
      id: item.id,
      user_id: item.userId,
      ingredient_id: item.ingredientId,
      in_stock: item.inStock,
      quantity: item.quantity,
      is_low_stock: item.isLowStock,
    },
    { onConflict: 'user_id,ingredient_id' },
  );

  if (error) {
    console.error('[supabaseService] upsertPantryItem error:', error);
    throw error;
  }
}

export async function deletePantryItem(userId: string, ingredientId: string): Promise<void> {
  const { error } = await supabase
    .from('pantry_items')
    .delete()
    .eq('user_id', userId)
    .eq('ingredient_id', ingredientId);

  if (error) {
    console.error('[supabaseService] deletePantryItem error:', error);
    throw error;
  }
}

// ─── Freezer ─────────────────────────────────────────────────────────────────

export async function fetchFreezerItems(userId: string): Promise<FreezerItem[]> {
  const { data, error } = await supabase
    .from('freezer_items')
    .select(
      'id, user_id, label, type, recipe_id, ingredient_id, portions, quantity, frozen_at, use_by_date',
    )
    .eq('user_id', userId);

  if (error) {
    console.error('[supabaseService] fetchFreezerItems error:', error);
    return [];
  }
  if (!data) return [];

  return data.map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    label: row.label as string,
    type: row.type as 'meal' | 'ingredient',
    recipeId: (row.recipe_id as string | undefined) ?? undefined,
    ingredientId: (row.ingredient_id as string | undefined) ?? undefined,
    portions: (row.portions as number | undefined) ?? undefined,
    quantity: (row.quantity as number | undefined) ?? undefined,
    frozenAt: row.frozen_at as string,
    useByDate: (row.use_by_date as string | undefined) ?? undefined,
  }));
}

export async function insertFreezerItem(item: Omit<FreezerItem, 'id'>): Promise<FreezerItem> {
  const { data, error } = await supabase
    .from('freezer_items')
    .insert({
      user_id: item.userId,
      label: item.label,
      type: item.type,
      recipe_id: item.recipeId ?? null,
      ingredient_id: item.ingredientId ?? null,
      portions: item.portions ?? null,
      quantity: item.quantity ?? null,
      frozen_at: item.frozenAt,
      use_by_date: item.useByDate ?? null,
    })
    .select('id, user_id, label, type, recipe_id, ingredient_id, portions, quantity, frozen_at, use_by_date')
    .single();

  if (error) {
    console.error('[supabaseService] insertFreezerItem error:', error);
    throw error;
  }

  return {
    id: data.id as string,
    userId: data.user_id as string,
    label: data.label as string,
    type: data.type as 'meal' | 'ingredient',
    recipeId: (data.recipe_id as string | undefined) ?? undefined,
    ingredientId: (data.ingredient_id as string | undefined) ?? undefined,
    portions: (data.portions as number | undefined) ?? undefined,
    quantity: (data.quantity as number | undefined) ?? undefined,
    frozenAt: data.frozen_at as string,
    useByDate: (data.use_by_date as string | undefined) ?? undefined,
  };
}

export async function updateFreezerItem(id: string, updates: Partial<FreezerItem>): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.label !== undefined) payload['label'] = updates.label;
  if (updates.type !== undefined) payload['type'] = updates.type;
  if (updates.recipeId !== undefined) payload['recipe_id'] = updates.recipeId;
  if (updates.ingredientId !== undefined) payload['ingredient_id'] = updates.ingredientId;
  if (updates.portions !== undefined) payload['portions'] = updates.portions;
  if (updates.quantity !== undefined) payload['quantity'] = updates.quantity;
  if (updates.frozenAt !== undefined) payload['frozen_at'] = updates.frozenAt;
  if (updates.useByDate !== undefined) payload['use_by_date'] = updates.useByDate;

  const { error } = await supabase.from('freezer_items').update(payload).eq('id', id);

  if (error) {
    console.error('[supabaseService] updateFreezerItem error:', error);
    throw error;
  }
}

export async function deleteFreezerItem(id: string): Promise<void> {
  const { error } = await supabase.from('freezer_items').delete().eq('id', id);

  if (error) {
    console.error('[supabaseService] deleteFreezerItem error:', error);
    throw error;
  }
}

// ─── Family Members ──────────────────────────────────────────────────────────

export async function fetchFamilyMembers(userId: string): Promise<FamilyMember[]> {
  const { data, error } = await supabase
    .from('family_members')
    .select('id, user_id, name, avatar_emoji, allergens, dislikes, diet_type')
    .eq('user_id', userId);

  if (error) {
    console.error('[supabaseService] fetchFamilyMembers error:', error);
    return [];
  }
  if (!data) return [];

  return data.map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    avatarEmoji: row.avatar_emoji as string,
    allergens: (row.allergens as string[]) ?? [],
    dislikes: (row.dislikes as string[]) ?? [],
    dietType: row.diet_type as FamilyMember['dietType'],
  }));
}

export async function upsertFamilyMember(member: FamilyMember): Promise<void> {
  const { error } = await supabase.from('family_members').upsert(
    {
      id: member.id,
      user_id: member.userId,
      name: member.name,
      avatar_emoji: member.avatarEmoji,
      allergens: member.allergens,
      dislikes: member.dislikes,
      diet_type: member.dietType,
    },
    { onConflict: 'id' },
  );

  if (error) {
    console.error('[supabaseService] upsertFamilyMember error:', error);
    throw error;
  }
}

export async function deleteFamilyMember(id: string): Promise<void> {
  const { error } = await supabase.from('family_members').delete().eq('id', id);

  if (error) {
    console.error('[supabaseService] deleteFamilyMember error:', error);
    throw error;
  }
}

// ─── Budget ──────────────────────────────────────────────────────────────────

export async function fetchBudgetSettings(userId: string): Promise<BudgetSettings | null> {
  const { data, error } = await supabase
    .from('budget_settings')
    .select('user_id, weekly_budget')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[supabaseService] fetchBudgetSettings error:', error);
    return null;
  }
  if (!data) return null;

  return {
    userId: data.user_id as string,
    weeklyBudget: data.weekly_budget as number,
  };
}

export async function upsertBudgetSettings(settings: BudgetSettings): Promise<void> {
  const { error } = await supabase.from('budget_settings').upsert(
    {
      user_id: settings.userId,
      weekly_budget: settings.weeklyBudget,
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    console.error('[supabaseService] upsertBudgetSettings error:', error);
    throw error;
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function fetchTemplates(userId: string): Promise<MealPlanTemplate[]> {
  const { data, error } = await supabase
    .from('meal_plan_templates')
    .select('id, user_id, name, days, created_at, last_used_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[supabaseService] fetchTemplates error:', error);
    return [];
  }
  if (!data) return [];

  return data.map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    days: row.days as MealPlanTemplate['days'],
    createdAt: row.created_at as string,
    lastUsedAt: (row.last_used_at as string | undefined) ?? undefined,
  }));
}

export async function upsertTemplate(template: MealPlanTemplate): Promise<void> {
  const { error } = await supabase.from('meal_plan_templates').upsert(
    {
      id: template.id,
      user_id: template.userId,
      name: template.name,
      days: template.days,
      last_used_at: template.lastUsedAt ?? null,
    },
    { onConflict: 'id' },
  );

  if (error) {
    console.error('[supabaseService] upsertTemplate error:', error);
    throw error;
  }
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('meal_plan_templates').delete().eq('id', id);

  if (error) {
    console.error('[supabaseService] deleteTemplate error:', error);
    throw error;
  }
}

// ─── Imported Recipes ────────────────────────────────────────────────────────

export async function fetchImportedRecipes(userId: string): Promise<ImportedRecipe[]> {
  const { data, error } = await supabase
    .from('imported_recipes')
    .select('id, user_id, recipe_data, source, external_id, imported_at')
    .eq('user_id', userId);

  if (error) {
    console.error('[supabaseService] fetchImportedRecipes error:', error);
    return [];
  }
  if (!data) return [];

  return data.map((row) => {
    const base = row.recipe_data as Omit<ImportedRecipe, 'source' | 'externalId' | 'importedAt' | 'userId'>;
    return {
      ...base,
      id: row.id as string,
      userId: row.user_id as string,
      source: row.source as ImportedRecipe['source'],
      externalId: row.external_id as string,
      importedAt: row.imported_at as string,
    };
  });
}

export async function insertImportedRecipe(recipe: ImportedRecipe): Promise<void> {
  const { source, externalId, importedAt, userId, id, ...base } = recipe;
  const { error } = await supabase.from('imported_recipes').insert({
    id,
    user_id: userId,
    source,
    external_id: externalId,
    imported_at: importedAt,
    recipe_data: base,
  });

  if (error) {
    console.error('[supabaseService] insertImportedRecipe error:', error);
    throw error;
  }
}

export async function deleteImportedRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('imported_recipes').delete().eq('id', id);

  if (error) {
    console.error('[supabaseService] deleteImportedRecipe error:', error);
    throw error;
  }
}

// ─── Custom Recipes ──────────────────────────────────────────────────────────

export async function fetchCustomRecipes(userId: string): Promise<CustomRecipe[]> {
  const { data, error } = await supabase
    .from('custom_recipes')
    .select('id, user_id, recipe_data, created_at, updated_at')
    .eq('user_id', userId);

  if (error) {
    console.error('[supabaseService] fetchCustomRecipes error:', error);
    return [];
  }
  if (!data) return [];

  return data.map((row) => {
    const base = row.recipe_data as Omit<CustomRecipe, 'source' | 'createdAt' | 'updatedAt' | 'userId'>;
    return {
      ...base,
      id: row.id as string,
      userId: row.user_id as string,
      source: 'custom' as const,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  });
}

export async function insertCustomRecipe(recipe: CustomRecipe): Promise<void> {
  const { source, createdAt, updatedAt, userId, id, ...base } = recipe;
  const { error } = await supabase.from('custom_recipes').insert({
    id,
    user_id: userId,
    recipe_data: base,
    created_at: createdAt,
    updated_at: updatedAt,
  });

  if (error) {
    console.error('[supabaseService] insertCustomRecipe error:', error);
    throw error;
  }
}

export async function updateCustomRecipe(id: string, updates: Partial<CustomRecipe>): Promise<void> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Merge recipe_data fields (all except meta fields)
  const { source: _s, createdAt: _c, updatedAt: _u, userId: _uid, id: _id, ...dataUpdates } = updates;
  if (Object.keys(dataUpdates).length > 0) {
    payload['recipe_data'] = dataUpdates;
  }

  const { error } = await supabase.from('custom_recipes').update(payload).eq('id', id);

  if (error) {
    console.error('[supabaseService] updateCustomRecipe error:', error);
    throw error;
  }
}

export async function deleteCustomRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('custom_recipes').delete().eq('id', id);

  if (error) {
    console.error('[supabaseService] deleteCustomRecipe error:', error);
    throw error;
  }
}

// ─── Scan History ────────────────────────────────────────────────────────────

export async function fetchScanHistory(userId: string): Promise<ScanHistoryEntry[]> {
  const { data, error } = await supabase
    .from('scan_history')
    .select('id, user_id, barcode, product_name, matched_ingredient_id, scanned_at, action')
    .eq('user_id', userId)
    .order('scanned_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[supabaseService] fetchScanHistory error:', error);
    return [];
  }
  if (!data) return [];

  return data.map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    barcode: row.barcode as string,
    productName: row.product_name as string,
    matchedIngredientId: (row.matched_ingredient_id as string | undefined) ?? undefined,
    scannedAt: row.scanned_at as string,
    action: row.action as string,
  }));
}

export async function insertScanEntry(entry: ScanHistoryEntry): Promise<void> {
  const { error } = await supabase.from('scan_history').insert({
    id: entry.id,
    user_id: entry.userId,
    barcode: entry.barcode,
    product_name: entry.productName,
    matched_ingredient_id: entry.matchedIngredientId ?? null,
    scanned_at: entry.scannedAt,
    action: entry.action,
  });

  if (error) {
    console.error('[supabaseService] insertScanEntry error:', error);
    throw error;
  }
}

export async function deleteScanHistory(userId: string): Promise<void> {
  const { error } = await supabase.from('scan_history').delete().eq('user_id', userId);

  if (error) {
    console.error('[supabaseService] deleteScanHistory error:', error);
    throw error;
  }
}

// ─── User Recipe Data (favourites / ratings) ─────────────────────────────────

export async function fetchUserRecipeData(
  userId: string,
): Promise<{ recipeId: string; isFavourite: boolean; rating: number | null }[]> {
  const { data, error } = await supabase
    .from('user_recipe_data')
    .select('recipe_id, is_favourite, rating')
    .eq('user_id', userId);

  if (error) {
    console.error('[supabaseService] fetchUserRecipeData error:', error);
    return [];
  }
  if (!data) return [];

  return data.map((row) => ({
    recipeId: row.recipe_id as string,
    isFavourite: row.is_favourite as boolean,
    rating: row.rating as number | null,
  }));
}

export async function upsertUserRecipeData(
  userId: string,
  recipeId: string,
  isFavourite: boolean,
  rating: number | null,
): Promise<void> {
  const { error } = await supabase.from('user_recipe_data').upsert(
    {
      user_id: userId,
      recipe_id: recipeId,
      is_favourite: isFavourite,
      rating,
    },
    { onConflict: 'user_id,recipe_id' },
  );

  if (error) {
    console.error('[supabaseService] upsertUserRecipeData error:', error);
    throw error;
  }
}
