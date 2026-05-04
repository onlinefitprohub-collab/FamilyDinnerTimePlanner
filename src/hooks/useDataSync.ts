import { useEffect } from 'react';
import { useMealPlanStore } from '../stores/useMealPlanStore';
import { usePantryStore } from '../stores/usePantryStore';
import { useFreezerStore } from '../stores/useFreezerStore';
import { useFamilyStore } from '../stores/useFamilyStore';
import { useBudgetStore } from '../stores/useBudgetStore';
import { useFavouritesStore } from '../stores/useFavouritesStore';
import { useRecipeDataStore } from '../stores/useRecipeDataStore';
import { useTemplatesStore } from '../stores/useTemplatesStore';
import { useScanStore } from '../stores/useScanStore';

export function useDataSync(userId: string | null): void {
  const syncMealPlan = useMealPlanStore((s) => s.syncFromSupabase);
  const subMealPlan = useMealPlanStore((s) => s.subscribeToRealtime);
  const syncPantry = usePantryStore((s) => s.syncFromSupabase);
  const subPantry = usePantryStore((s) => s.subscribeToRealtime);
  const syncFreezer = useFreezerStore((s) => s.syncFromSupabase);
  const subFreezer = useFreezerStore((s) => s.subscribeToRealtime);
  const syncFamily = useFamilyStore((s) => s.syncFromSupabase);
  const subFamily = useFamilyStore((s) => s.subscribeToRealtime);
  const syncBudget = useBudgetStore((s) => s.syncFromSupabase);
  const syncFavourites = useFavouritesStore((s) => s.syncFromSupabase);
  const subFavourites = useFavouritesStore((s) => s.subscribeToRealtime);
  const syncRecipes = useRecipeDataStore((s) => s.syncFromSupabase);
  const syncTemplates = useTemplatesStore((s) => s.syncFromSupabase);
  const syncScans = useScanStore((s) => s.syncFromSupabase);

  useEffect(() => {
    if (!userId) return;

    void Promise.all([
      syncMealPlan(),
      syncPantry(),
      syncFreezer(),
      syncFamily(),
      syncBudget(userId),
      syncFavourites(),
      syncRecipes(),
      syncTemplates(userId),
      syncScans(userId),
    ]);

    const unsubMealPlan = subMealPlan(userId);
    const unsubPantry = subPantry(userId);
    const unsubFreezer = subFreezer(userId);
    const unsubFamily = subFamily(userId);
    const unsubFavourites = subFavourites(userId);

    return () => {
      unsubMealPlan();
      unsubPantry();
      unsubFreezer();
      unsubFamily();
      unsubFavourites();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
}
