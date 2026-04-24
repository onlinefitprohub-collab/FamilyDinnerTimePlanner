import { useMemo } from 'react';
import { useRecipeLibrary } from './useRecipeLibrary';
import { useFamilyStore } from '../stores/useFamilyStore';
import { checkAllergenConflicts, getConflictSeverity } from '../utils/allergens';
import { AllergenConflict } from '../types';

export function useAllergenCheck(recipeId: string): {
  conflicts: AllergenConflict[];
  severity: 'danger' | 'warning' | 'none';
} {
  const { getRecipeById } = useRecipeLibrary();
  const members = useFamilyStore((s) => s.members);

  const conflicts = useMemo<AllergenConflict[]>(() => {
    const recipe = getRecipeById(recipeId);
    if (!recipe || members.length === 0) return [];
    return checkAllergenConflicts(recipe, members);
  }, [recipeId, getRecipeById, members]);

  const severity = useMemo(
    () => getConflictSeverity(conflicts),
    [conflicts],
  );

  return { conflicts, severity };
}
