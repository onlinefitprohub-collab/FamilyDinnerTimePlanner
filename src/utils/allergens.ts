import { AnyRecipe, FamilyMember, AllergenConflict, Allergen } from '../types';

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  celery: 'Celery',
  gluten: 'Gluten',
  crustaceans: 'Crustaceans',
  eggs: 'Eggs',
  fish: 'Fish',
  lupin: 'Lupin',
  milk: 'Milk',
  molluscs: 'Molluscs',
  mustard: 'Mustard',
  peanuts: 'Peanuts',
  sesame: 'Sesame',
  soybeans: 'Soybeans',
  sulphites: 'Sulphites',
  'tree-nuts': 'Tree Nuts',
};

/**
 * Check whether a recipe contains allergens or dislikes for any family member.
 * Returns one AllergenConflict per member that has at least one conflict.
 */
export function checkAllergenConflicts(
  recipe: AnyRecipe,
  members: FamilyMember[],
): AllergenConflict[] {
  const conflicts: AllergenConflict[] = [];

  for (const member of members) {
    const allergenHits: Allergen[] = member.allergens.filter((a) =>
      recipe.allergens.includes(a),
    );

    // Check dislikes against ingredient IDs / names in recipe
    const recipeIngredientIds = new Set(recipe.ingredients.map((i) => i.ingredientId));
    const dislikeHits: string[] = member.dislikes.filter((d) =>
      recipeIngredientIds.has(d),
    );

    // Diet-type conflicts
    const dietConflicts = getDietConflicts(member, recipe);

    if (allergenHits.length > 0 || dislikeHits.length > 0 || dietConflicts.length > 0) {
      conflicts.push({
        memberId: member.id,
        memberName: member.name,
        conflictType: allergenHits.length > 0 ? 'allergen' : 'dislike',
        allergens: allergenHits,
        dislikes: [...dislikeHits, ...dietConflicts],
      });
    }
  }

  return conflicts;
}

function getDietConflicts(member: FamilyMember, recipe: AnyRecipe): string[] {
  const issues: string[] = [];

  switch (member.dietType) {
    case 'vegetarian':
      if (!recipe.dietaryInfo.vegetarian) {
        issues.push('contains meat');
      }
      break;
    case 'vegan':
      if (!recipe.dietaryInfo.vegan) {
        issues.push('not vegan');
      }
      break;
    case 'gluten-free':
      if (!recipe.dietaryInfo.glutenFree) {
        issues.push('contains gluten');
      }
      break;
    case 'dairy-free':
      if (!recipe.dietaryInfo.dairyFree) {
        issues.push('contains dairy');
      }
      break;
    default:
      break;
  }

  return issues;
}

/**
 * Returns the overall severity of conflicts:
 * - 'danger'  → at least one allergen conflict
 * - 'warning' → dislike / diet conflict only
 * - 'none'    → no conflicts
 */
export function getConflictSeverity(
  conflicts: AllergenConflict[],
): 'danger' | 'warning' | 'none' {
  if (conflicts.length === 0) return 'none';

  const hasAllergen = conflicts.some((c) => c.conflictType === 'allergen' && c.allergens.length > 0);
  if (hasAllergen) return 'danger';

  return 'warning';
}
