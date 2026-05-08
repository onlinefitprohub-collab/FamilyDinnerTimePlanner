import React, { useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { useMealPlanStore } from '../../src/stores/useMealPlanStore';
import { useBudgetStore } from '../../src/stores/useBudgetStore';
import { useFavouritesStore } from '../../src/stores/useFavouritesStore';
import { useCookHistoryStore } from '../../src/stores/useCookHistoryStore';
import { useRecipeLibrary } from '../../src/hooks/useRecipeLibrary';
import { getActiveDeals } from '../../src/data/deals';
import { getSeasonalIngredients } from '../../src/data/seasonal';
import { calculateRecipeCost } from '../../src/utils/pricing';
import { calculateWeeklyNutrition } from '../../src/utils/nutrition';
import SupermarketChip from '../../src/components/SupermarketChip';
import { ingredients as allIngredients } from '../../src/data/ingredients';
import { WeeklyMealPlan, AnyRecipe } from '../../src/types';
import { FONTS } from '../../src/theme/typography';

const DAYS: Array<{ key: keyof Omit<WeeklyMealPlan, 'id' | 'userId' | 'weekKey'>; label: string }> = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

export default function HomeScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const familySize = useAuthStore((s) => s.familySize);
  const getCurrentWeekKey = useMealPlanStore((s) => s.getCurrentWeekKey);
  const plans = useMealPlanStore((s) => s.plans);
  const weeklyBudget = useBudgetStore((s) => s.weeklyBudget);
  const ratings = useFavouritesStore((s) => s.ratings);
  const { recipes, isLoading } = useRecipeLibrary();

  const weekKey = getCurrentWeekKey();
  const currentPlan = plans[weekKey];
  const currentMonth = new Date().getMonth() + 1;
  const today = new Date();
  const dayOfYear = getDayOfYear(today);

  const activeDeals = useMemo(() => getActiveDeals(), []);
  const seasonalIngredients = useMemo(() => getSeasonalIngredients(currentMonth), [currentMonth]);

  const weekTotalCost = useMemo(() => {
    if (!currentPlan || recipes.length === 0) return 0;
    return DAYS.reduce((sum, { key }) => {
      const recipeId = currentPlan[key];
      if (!recipeId) return sum;
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe) return sum;
      const cost = calculateRecipeCost(recipe, allIngredients, familySize);
      return sum + cost;
    }, 0);
  }, [currentPlan, recipes, familySize]);

  const budgetProgress = weeklyBudget > 0 ? Math.min(weekTotalCost / weeklyBudget, 1) : 0;
  const budgetBarColour =
    budgetProgress > 0.9 ? '#C0392B' : budgetProgress > 0.7 ? '#E8A020' : '#8FAF7E';

  const totalCooksEver = useCookHistoryStore((s) => Object.values(s.history).reduce((sum, dates) => sum + dates.length, 0));

  // Detect today's day key (0=Sun … 6=Sat → map to DAYS keys)
  const todayDayKey = useMemo<keyof Omit<WeeklyMealPlan, 'id' | 'userId' | 'weekKey'> | null>(() => {
    const jsDay = today.getDay(); // 0=Sun
    const map: (keyof Omit<WeeklyMealPlan, 'id' | 'userId' | 'weekKey'>)[] = [
      'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
    ];
    return map[jsDay] ?? null;
  }, [today]);

  const tonightRecipe = useMemo<AnyRecipe | null>(() => {
    if (!todayDayKey || !currentPlan) return null;
    const recipeId = currentPlan[todayDayKey];
    if (!recipeId) return null;
    return recipes.find((r) => r.id === recipeId) ?? null;
  }, [todayDayKey, currentPlan, recipes]);

  const topRatedRecipes = useMemo(() => {
    return [...recipes]
      .filter((r) => ratings[r.id] !== undefined)
      .sort((a, b) => (ratings[b.id] ?? 0) - (ratings[a.id] ?? 0))
      .slice(0, 3);
  }, [recipes, ratings]);

  const recipeOfTheDay = useMemo(() => {
    if (recipes.length === 0) return null;
    return recipes[dayOfYear % recipes.length];
  }, [recipes, dayOfYear]);

  const quickestThisWeek = useMemo<{ recipe: AnyRecipe; day: string; totalTime: number } | null>(() => {
    if (!currentPlan || recipes.length === 0) return null;
    let best: { recipe: AnyRecipe; day: string; totalTime: number } | null = null;
    for (const { key, label } of DAYS) {
      const recipeId = currentPlan[key];
      if (!recipeId) continue;
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe) continue;
      const totalTime = recipe.prepTime + recipe.cookTime;
      if (!best || totalTime < best.totalTime) {
        best = { recipe, day: label, totalTime };
      }
    }
    return best;
  }, [currentPlan, recipes]);

  const savingsTip = useMemo<{ savings: number; count: number } | null>(() => {
    if (!currentPlan || recipes.length === 0) return null;
    const weekIngredientIds = new Set<string>();
    for (const { key } of DAYS) {
      const recipeId = currentPlan[key];
      if (!recipeId) continue;
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe) continue;
      for (const ing of recipe.ingredients) weekIngredientIds.add(ing.ingredientId);
    }
    let totalSavings = 0;
    let cheaperCount = 0;
    for (const ingId of weekIngredientIds) {
      const ing = allIngredients.find((i) => i.id === ingId);
      if (!ing || ing.prices.length < 2) continue;
      const prices = ing.prices.map((p) => p.pricePerUnit);
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);
      if (maxPrice - minPrice > 0.05) {
        totalSavings += maxPrice - minPrice;
        cheaperCount++;
      }
    }
    if (totalSavings < 0.5 || cheaperCount === 0) return null;
    return { savings: totalSavings, count: cheaperCount };
  }, [currentPlan, recipes]);

  const weekNutrition = useMemo(
    () => calculateWeeklyNutrition(currentPlan, recipes, familySize),
    [currentPlan, recipes, familySize],
  );

  const firstFourDeals = activeDeals.slice(0, 4);

  const familyName = profile?.familyName ?? 'Family';
  const timeOfDay = getTimeOfDay();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E8A020" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Welcome Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.welcomeText}>
          Good {timeOfDay},{' '}
          <Text style={styles.familyName}>{familyName}!</Text>
        </Text>
        <View style={styles.subheaderRow}>
          <Text style={styles.subheader}>
            Planning for <Text style={styles.bold}>{familySize} people</Text>
          </Text>
          {totalCooksEver > 0 && (
            <Pressable
              onPress={() => router.push('/stats' as Parameters<typeof router.push>[0])}
              style={({ pressed }) => [styles.cookStatPill, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.cookStatText}>🍳 {totalCooksEver} cooked</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Tonight's Dinner */}
      {tonightRecipe ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tonight's Dinner</Text>
          <Pressable
            onPress={() => router.push(`/recipe/${tonightRecipe.id}` as Parameters<typeof router.push>[0])}
            style={({ pressed }) => [styles.tonightCard, pressed && { opacity: 0.92 }]}
          >
            <Image
              source={{ uri: tonightRecipe.image }}
              style={styles.tonightImage}
              contentFit="cover"
              transition={200}
            />
            <View style={styles.tonightOverlay}>
              <View style={styles.tonightInfo}>
                <Text style={styles.tonightName} numberOfLines={2}>{tonightRecipe.name}</Text>
                <Text style={styles.tonightMeta}>
                  {tonightRecipe.prepTime + tonightRecipe.cookTime} mins ·{' '}
                  £{familySize > 0
                    ? (calculateRecipeCost(tonightRecipe, allIngredients, familySize) / familySize).toFixed(2)
                    : '—'}pp
                </Text>
              </View>
              <Pressable
                onPress={() => router.push(`/recipe/cooking/${tonightRecipe.id}` as Parameters<typeof router.push>[0])}
                style={({ pressed }) => [styles.tonightCookBtn, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="flame-outline" size={16} color="#1A2B4A" />
                <Text style={styles.tonightCookBtnText}>Cook</Text>
              </Pressable>
            </View>
          </Pressable>
        </View>
      ) : (
        <View style={styles.section}>
          <Pressable
            onPress={() => router.push('/(tabs)/planner' as Parameters<typeof router.push>[0])}
            style={({ pressed }) => [styles.noTonightCard, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.noTonightIcon}>🍽️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.noTonightTitle}>No dinner planned tonight</Text>
              <Text style={styles.noTonightSub}>Tap to add a meal for today</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </Pressable>
        </View>
      )}

      {/* 2. This Week Mini Meal-Plan Strip */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>This Week</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stripScroll}>
          <View style={styles.dayStrip}>
            {DAYS.map(({ key, label }) => {
              const recipeId = currentPlan?.[key];
              const recipe = recipeId ? recipes.find((r) => r.id === recipeId) : null;
              return (
                <Pressable
                  key={key}
                  onPress={() => router.push('/(tabs)/planner')}
                  style={({ pressed }) => [styles.dayCard, pressed && styles.dayCardPressed]}
                >
                  <Text style={styles.dayLabel}>{label}</Text>
                  <Text style={styles.dayRecipe} numberOfLines={2}>
                    {recipe ? recipe.name : '—'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* 3. Budget Progress Bar */}
      {weeklyBudget > 0 && (
        <View style={styles.section}>
          <View style={styles.budgetRow}>
            <Text style={styles.sectionTitle}>Weekly Budget</Text>
            <Text style={styles.budgetNumbers}>
              £{weekTotalCost.toFixed(2)} / £{weeklyBudget.toFixed(2)}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.round(budgetProgress * 100)}%` as `${number}%`,
                  backgroundColor: budgetBarColour,
                },
              ]}
            />
          </View>
          <Text style={styles.budgetCaption}>
            {budgetProgress >= 1
              ? 'Over budget!'
              : `£${(weeklyBudget - weekTotalCost).toFixed(2)} remaining`}
          </Text>
        </View>
      )}

      {/* 3b. Quickest This Week */}
      {quickestThisWeek && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quickest This Week</Text>
          <Pressable
            onPress={() => router.push(`/recipe/${quickestThisWeek.recipe.id}`)}
            style={({ pressed }) => [styles.quickestCard, pressed && styles.rowPressed]}
          >
            <View style={styles.quickestIconWrap}>
              <Text style={styles.quickestIcon}>⚡</Text>
            </View>
            <View style={styles.quickestInfo}>
              <Text style={styles.quickestName} numberOfLines={1}>
                {quickestThisWeek.recipe.name}
              </Text>
              <Text style={styles.quickestMeta}>
                {quickestThisWeek.day} · {quickestThisWeek.totalTime} mins total
              </Text>
            </View>
            <Text style={styles.quickestArrow}>›</Text>
          </Pressable>
        </View>
      )}

      {/* 3c. Savings Tip */}
      {savingsTip && (
        <View style={styles.section}>
          <View style={styles.savingsTip}>
            <Text style={styles.savingsIcon}>💰</Text>
            <Text style={styles.savingsText}>
              Switch{' '}
              <Text style={styles.savingsBold}>{savingsTip.count} ingredient{savingsTip.count !== 1 ? 's' : ''}</Text>
              {' '}to Lidl/Aldi this week and save up to{' '}
              <Text style={styles.savingsBold}>£{savingsTip.savings.toFixed(2)}</Text>
            </Text>
          </View>
        </View>
      )}

      {/* 3d. Nutrition snapshot */}
      {weekNutrition.avgDailyCalories > 0 && (
        <View style={styles.section}>
          <Pressable
            onPress={() => router.push('/nutrition' as Parameters<typeof router.push>[0])}
            style={({ pressed }) => [styles.nutritionCard, pressed && styles.rowPressed]}
          >
            <View style={styles.nutritionCardHeader}>
              <Text style={styles.sectionTitle}>This Week's Nutrition{'\n'}<Text style={styles.nutritionPerPerson}>per person</Text></Text>
              <Text style={styles.nutritionSeeAll}>Details ›</Text>
            </View>
            <View style={styles.nutritionStats}>
              <View style={styles.nutritionStat}>
                <Text style={styles.nutritionStatValue}>{Math.round(weekNutrition.avgDailyCalories / familySize)}</Text>
                <Text style={styles.nutritionStatLabel}>avg kcal/day</Text>
              </View>
              <View style={styles.nutritionStatDivider} />
              <View style={styles.nutritionStat}>
                <Text style={styles.nutritionStatValue}>{Math.round(weekNutrition.totalProtein / familySize)}g</Text>
                <Text style={styles.nutritionStatLabel}>protein / week</Text>
              </View>
              <View style={styles.nutritionStatDivider} />
              <View style={styles.nutritionStat}>
                <Text style={styles.nutritionStatValue}>{Math.round(weekNutrition.totalCarbs / familySize)}g</Text>
                <Text style={styles.nutritionStatLabel}>carbs / week</Text>
              </View>
            </View>
          </Pressable>
        </View>
      )}

      {/* 4. This Week's Deals */}
      {firstFourDeals.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Week's Deals</Text>
          <View style={styles.dealsGrid}>
            {firstFourDeals.map((deal, index) => (
              <View key={`${deal.ingredientId}-${index}`} style={styles.dealCard}>
                <SupermarketChip supermarket={deal.supermarket} small />
                <Text style={styles.dealLabel} numberOfLines={2}>
                  {deal.dealLabel}
                </Text>
                <View style={styles.dealPriceRow}>
                  <Text style={styles.dealOriginalPrice}>£{deal.originalPrice.toFixed(2)}</Text>
                  <Text style={styles.dealSalePrice}>£{deal.dealPrice.toFixed(2)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 5. In Season This Month */}
      {seasonalIngredients.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>In Season This Month</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.seasonalRow}>
              {seasonalIngredients.map((ing) => (
                <View key={ing.ingredientId ?? ing.name} style={styles.seasonalChip}>
                  <Text style={styles.seasonalChipText}>{ing.name}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* 6. What Can I Make? */}
      <View style={styles.section}>
        <Pressable
          onPress={() => router.push('/pantry')}
          style={({ pressed }) => [styles.pantryButton, pressed && styles.pantryButtonPressed]}
        >
          <Text style={styles.pantryButtonText}>🍳 What Can I Make?</Text>
          <Text style={styles.pantryButtonSub}>Based on your pantry</Text>
        </Pressable>
      </View>

      {/* 7. Top Rated Meals */}
      {topRatedRecipes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Rated Meals</Text>
          <View style={styles.topRatedList}>
            {topRatedRecipes.map((recipe, index) => {
              const rating = ratings[recipe.id] ?? 0;
              return (
                <Pressable
                  key={recipe.id}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                  style={({ pressed }) => [styles.topRatedRow, pressed && styles.rowPressed]}
                >
                  <Text style={styles.topRatedRank}>#{index + 1}</Text>
                  <View style={styles.topRatedInfo}>
                    <Text style={styles.topRatedName} numberOfLines={1}>
                      {recipe.name}
                    </Text>
                    <Text style={styles.topRatedTime}>
                      {recipe.prepTime + recipe.cookTime}m
                    </Text>
                  </View>
                  <View style={styles.starsRow}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Text key={i} style={styles.star}>
                        {i < rating ? '★' : '☆'}
                      </Text>
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* 8. Recipe of the Day */}
      {recipeOfTheDay && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recipe of the Day</Text>
          <Pressable
            onPress={() => router.push(`/recipe/${recipeOfTheDay.id}`)}
            style={({ pressed }) => [styles.rotdCard, pressed && styles.rowPressed]}
          >
            <View style={styles.rotdContent}>
              <Text style={styles.rotdName} numberOfLines={1}>
                {recipeOfTheDay.name}
              </Text>
              <Text style={styles.rotdDesc} numberOfLines={2}>
                {recipeOfTheDay.description}
              </Text>
              <View style={styles.rotdMeta}>
                <Text style={styles.rotdMetaText}>
                  {recipeOfTheDay.prepTime + recipeOfTheDay.cookTime}m ·{' '}
                  {recipeOfTheDay.difficulty.charAt(0).toUpperCase() +
                    recipeOfTheDay.difficulty.slice(1)}
                </Text>
              </View>
            </View>
            <View style={styles.rotdArrow}>
              <Text style={styles.rotdArrowText}>›</Text>
            </View>
          </Pressable>
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAF8',
  },
  header: {
    backgroundColor: '#1A2B4A',
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontFamily: FONTS.body,
    color: '#FFFFFF',
  },
  familyName: {
    fontFamily: FONTS.headingBold,
    color: '#E8A020',
  },
  subheaderRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  subheader: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
  },
  cookStatPill: {
    backgroundColor: 'rgba(232,160,32,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.4)',
  },
  cookStatText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E8A020',
  },
  bold: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: FONTS.heading,
    color: '#1A2B4A',
    marginBottom: 10,
  },
  stripScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  dayStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  dayCard: {
    width: 80,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
  },
  dayCardPressed: {
    opacity: 0.8,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A2B4A',
    marginBottom: 4,
  },
  dayRecipe: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 14,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  budgetNumbers: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2B4A',
  },
  progressTrack: {
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: 10,
    borderRadius: 5,
  },
  budgetCaption: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },
  dealsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dealCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  dealLabel: {
    fontSize: 12,
    color: '#1A2B4A',
    fontWeight: '500',
    lineHeight: 16,
  },
  dealPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dealOriginalPrice: {
    fontSize: 11,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  dealSalePrice: {
    fontSize: 13,
    color: '#8FAF7E',
    fontWeight: '700',
  },
  seasonalRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  seasonalChip: {
    backgroundColor: '#8FAF7E',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  seasonalChipText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  pantryButton: {
    backgroundColor: '#1A2B4A',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  pantryButtonPressed: {
    opacity: 0.85,
  },
  pantryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pantryButtonSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  topRatedList: {
    gap: 8,
  },
  topRatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  rowPressed: {
    opacity: 0.85,
  },
  topRatedRank: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E8A020',
    width: 24,
  },
  topRatedInfo: {
    flex: 1,
  },
  topRatedName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2B4A',
  },
  topRatedTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 1,
  },
  star: {
    fontSize: 14,
    color: '#E8A020',
  },
  rotdCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  rotdContent: {
    flex: 1,
    gap: 4,
  },
  rotdName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  rotdDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  rotdMeta: {
    marginTop: 4,
  },
  rotdMetaText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  rotdArrow: {
    paddingLeft: 8,
  },
  rotdArrowText: {
    fontSize: 28,
    color: '#E8A020',
    fontWeight: '300',
    lineHeight: 32,
  },
  bottomSpacer: {
    height: 16,
  },
  quickestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  quickestIconWrap: {
    width: 40,
    height: 40,
    backgroundColor: '#FFF9F0',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickestIcon: {
    fontSize: 20,
  },
  quickestInfo: {
    flex: 1,
    gap: 2,
  },
  quickestName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  quickestMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  quickestArrow: {
    fontSize: 24,
    color: '#E8A020',
    fontWeight: '300',
    lineHeight: 28,
  },
  savingsTip: {
    backgroundColor: '#F0FBF0',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#8FAF7E',
  },
  savingsIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
  savingsText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  savingsBold: {
    fontWeight: '700',
    color: '#1A2B4A',
  },
  nutritionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  nutritionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  nutritionSeeAll: {
    fontSize: 13,
    color: '#E8A020',
    fontWeight: '700',
  },
  nutritionPerPerson: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
  },
  nutritionStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nutritionStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  nutritionStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A2B4A',
  },
  nutritionStatLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  nutritionStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E5E7EB',
  },
  tonightCard: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  tonightImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  tonightOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26,43,74,0.55)',
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    gap: 12,
  },
  tonightInfo: {
    flex: 1,
    gap: 4,
  },
  tonightName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 26,
  },
  tonightMeta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
  },
  tonightCookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E8A020',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  tonightCookBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A2B4A',
  },
  noTonightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  noTonightIcon: {
    fontSize: 28,
  },
  noTonightTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  noTonightSub: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
});
