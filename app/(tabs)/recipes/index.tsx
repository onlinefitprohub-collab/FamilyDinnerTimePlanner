import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRecipeLibrary } from '../../../src/hooks/useRecipeLibrary';
import { useAuthStore } from '../../../src/stores/useAuthStore';
import { useFavouritesStore } from '../../../src/stores/useFavouritesStore';
import { useFamilyStore } from '../../../src/stores/useFamilyStore';
import { usePantryStore } from '../../../src/stores/usePantryStore';
import { useRecentlyViewedStore } from '../../../src/stores/useRecentlyViewedStore';
import RecipeCard from '../../../src/components/RecipeCard';
import { AnyRecipe, FamilyMember, AllergenConflict, Allergen } from '../../../src/types';
import { isRecipeInSeason, getActiveDealsForRecipe } from '../../../src/utils/seasonal';
import { checkAllergenConflicts, ALLERGEN_LABELS } from '../../../src/utils/allergens';
import { scoreRecipeByPantry, calculateRecipeCost } from '../../../src/utils/pricing';
import { ingredients as allIngredients } from '../../../src/data/ingredients';

type SortOption = 'name' | 'time' | 'cost' | 'difficulty' | 'rating';
type DifficultyOption = 'easy' | 'medium' | 'hard';

interface QuickFilter {
  id: string;
  label: string;
  test: (r: AnyRecipe, month: number, members: FamilyMember[]) => boolean;
}

const QUICK_FILTERS: QuickFilter[] = [
  {
    id: 'under30',
    label: 'Under 30 mins',
    test: (r) => r.prepTime + r.cookTime < 30,
  },
  {
    id: 'under45',
    label: 'Under 45 mins',
    test: (r) => r.prepTime + r.cookTime < 45,
  },
  {
    id: 'few-ingredients',
    label: '5 ingredients or fewer',
    test: (r) => r.ingredients.length <= 5,
  },
  {
    id: 'one-pot',
    label: 'One pot',
    test: (r) => r.onePot,
  },
  {
    id: 'freezer-friendly',
    label: 'Freezer-friendly',
    test: (r) => r.freezerFriendly,
  },
  {
    id: 'kid-friendly',
    label: 'Kid-friendly',
    test: (r) => r.kidFriendly,
  },
  {
    id: 'in-season',
    label: 'In season',
    test: (r, month) => isRecipeInSeason(r, month),
  },
  {
    id: 'deals',
    label: 'Deals available',
    test: (r) => getActiveDealsForRecipe(r).length > 0,
  },
  {
    id: 'safe-for-all',
    label: 'Safe for Everyone',
    test: (r, _month, members) =>
      members.length === 0 || checkAllergenConflicts(r, members).length === 0,
  },
  {
    id: 'convenience',
    label: 'Quick & Convenient',
    test: (r) => r.tags.includes('convenience'),
  },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'time', label: 'Quickest first' },
  { value: 'cost', label: 'Cheapest first' },
  { value: 'difficulty', label: 'Easiest first' },
  { value: 'rating', label: 'Top rated' },
];

const CATEGORY_OPTIONS = [
  'pasta', 'roast', 'curry', 'soup', 'pie', 'stir-fry', 'bake', 'grill', 'ready-meal', 'pizza',
] as const;

const DIETARY_OPTIONS = [
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'glutenFree', label: 'Gluten Free' },
  { key: 'dairyFree', label: 'Dairy Free' },
] as const;

const DIFFICULTY_OPTIONS: { value: DifficultyOption; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export default function RecipesScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { recipes, isLoading } = useRecipeLibrary();
  const familySize = useAuthStore((s) => s.familySize);
  const favourites = useFavouritesStore((s) => s.favourites);
  const ratings = useFavouritesStore((s) => s.ratings);
  const toggleFavourite = useFavouritesStore((s) => s.toggleFavourite);

  const familyMembers = useFamilyStore((s) => s.members);
  const pantryItems = usePantryStore((s) => s.items);
  const recentIds = useRecentlyViewedStore((s) => s.ids);

  const [searchText, setSearchText] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [sortOption, setSortOption] = useState<SortOption>('name');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [dietaryFilters, setDietaryFilters] = useState<Set<string>>(new Set());
  const [difficultyFilters, setDifficultyFilters] = useState<Set<DifficultyOption>>(new Set());
  const [excludedAllergens, setExcludedAllergens] = useState<Set<Allergen>>(new Set());
  const [fussyEaterMode, setFussyEaterMode] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@fussy_eater_mode').then((v) => setFussyEaterMode(v === 'true'));
  }, []);

  const currentMonth = new Date().getMonth() + 1;

  const toggleQuickFilter = useCallback((id: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleDietary = useCallback((key: string) => {
    setDietaryFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleAllergen = useCallback((allergen: Allergen) => {
    setExcludedAllergens((prev) => {
      const next = new Set(prev);
      if (next.has(allergen)) next.delete(allergen);
      else next.add(allergen);
      return next;
    });
  }, []);

  const toggleDifficulty = useCallback((value: DifficultyOption) => {
    setDifficultyFilters((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }, []);

  const filteredRecipes = useMemo(() => {
    let result = [...recipes];

    // Search
    if (searchText.trim().length > 0) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(lower) ||
          r.description.toLowerCase().includes(lower) ||
          r.tags.some((t) => t.toLowerCase().includes(lower)),
      );
    }

    // Category filter
    if (categoryFilter) {
      result = result.filter((r) => r.category === categoryFilter);
    }

    // Dietary filters
    if (dietaryFilters.size > 0) {
      result = result.filter((r) => {
        return Array.from(dietaryFilters).every((key) => {
          if (key === 'vegetarian') return r.dietaryInfo.vegetarian;
          if (key === 'vegan') return r.dietaryInfo.vegan;
          if (key === 'glutenFree') return r.dietaryInfo.glutenFree;
          if (key === 'dairyFree') return r.dietaryInfo.dairyFree;
          return true;
        });
      });
    }

    // Difficulty filter
    if (difficultyFilters.size > 0) {
      result = result.filter((r) => difficultyFilters.has(r.difficulty as DifficultyOption));
    }

    // Allergen exclusion filter
    if (excludedAllergens.size > 0) {
      result = result.filter((r) =>
        !r.allergens.some((a) => excludedAllergens.has(a)),
      );
    }

    // Fussy Eater Mode: hide recipes with any family member's disliked ingredient
    if (fussyEaterMode && familyMembers.length > 0) {
      result = result.filter((r) => {
        const conflicts = checkAllergenConflicts(r, familyMembers);
        return !conflicts.some((c) => c.dislikes.length > 0);
      });
    }

    // Quick filters (intersection)
    if (activeFilters.size > 0) {
      result = result.filter((r) =>
        Array.from(activeFilters).every((filterId) => {
          const qf = QUICK_FILTERS.find((f) => f.id === filterId);
          return qf ? qf.test(r, currentMonth, familyMembers) : true;
        }),
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortOption) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'time':
          return a.prepTime + a.cookTime - (b.prepTime + b.cookTime);
        case 'difficulty': {
          const order: Record<'easy' | 'medium' | 'hard', number> = { easy: 0, medium: 1, hard: 2 };
          return order[a.difficulty] - order[b.difficulty];
        }
        case 'cost': {
          const ca = calculateRecipeCost(a, allIngredients, familySize);
          const cb = calculateRecipeCost(b, allIngredients, familySize);
          return ca - cb;
        }
        case 'rating': {
          const ra = ratings[a.id] ?? 0;
          const rb = ratings[b.id] ?? 0;
          return rb - ra;
        }
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [recipes, searchText, categoryFilter, dietaryFilters, difficultyFilters, activeFilters, sortOption, ratings, currentMonth, fussyEaterMode, familyMembers, excludedAllergens]);

  const conflictsPerRecipe = useMemo<Record<string, AllergenConflict[]>>(() => {
    if (familyMembers.length === 0) return {};
    const map: Record<string, AllergenConflict[]> = {};
    for (const r of filteredRecipes) {
      const c = checkAllergenConflicts(r, familyMembers);
      if (c.length > 0) map[r.id] = c;
    }
    return map;
  }, [filteredRecipes, familyMembers]);

  const isFiltered =
    searchText.trim().length > 0 ||
    activeFilters.size > 0 ||
    categoryFilter !== null ||
    dietaryFilters.size > 0 ||
    difficultyFilters.size > 0 ||
    excludedAllergens.size > 0;

  // Recently viewed — resolve IDs to recipes in order
  const recentRecipes = useMemo(
    () =>
      recentIds
        .map((rid) => recipes.find((r) => r.id === rid))
        .filter((r): r is AnyRecipe => r !== undefined)
        .slice(0, 10),
    [recentIds, recipes],
  );

  // Recommended — top 8 recipes by pantry coverage (≥50%), safe for family
  const recommendedRecipes = useMemo(() => {
    const pantryIds = new Set(
      pantryItems.filter((p) => p.inStock).map((p) => p.ingredientId),
    );
    if (pantryIds.size === 0) return [];
    return recipes
      .map((r) => scoreRecipeByPantry(r, allIngredients, pantryIds, familySize))
      .filter((s) => s.coveragePercent >= 50)
      .sort((a, b) => b.coveragePercent - a.coveragePercent)
      .slice(0, 8)
      .map((s) => s.recipe);
  }, [recipes, pantryItems, familySize]);

  const activeFilterCount =
    (categoryFilter ? 1 : 0) + dietaryFilters.size + difficultyFilters.size + excludedAllergens.size;

  const renderItem = useCallback(
    ({ item }: { item: AnyRecipe }) => (
      <RecipeCard
        recipe={item}
        familySize={familySize}
        onPress={() => router.push(`/recipe/${item.id}`)}
        onFavouriteToggle={() => void toggleFavourite(item.id)}
        isFavourite={favourites[item.id] ?? false}
        familyConflicts={conflictsPerRecipe[item.id]}
        rating={ratings[item.id]}
      />
    ),
    [familySize, favourites, router, toggleFavourite, conflictsPerRecipe],
  );

  const keyExtractor = useCallback((item: AnyRecipe) => item.id, []);

  const ListHeaderComponent = useMemo(
    () => (
      <View>
        {/* Quick Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickFiltersContent}
          style={styles.quickFiltersScroll}
        >
          {QUICK_FILTERS.map((qf) => {
            const isActive = activeFilters.has(qf.id);
            return (
              <Pressable
                key={qf.id}
                onPress={() => toggleQuickFilter(qf.id)}
                style={[styles.quickFilterChip, isActive && styles.quickFilterChipActive]}
              >
                <Text style={[styles.quickFilterText, isActive && styles.quickFilterTextActive]}>
                  {qf.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Recently Viewed — only when not filtering */}
        {!isFiltered && recentRecipes.length > 0 && (
          <View style={styles.shelfSection}>
            <Text style={styles.shelfTitle}>Recently Viewed</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfContent}>
              {recentRecipes.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/recipe/${item.id}`)}
                  style={({ pressed }) => [styles.shelfCard, pressed && { opacity: 0.82 }]}
                >
                  <Image source={{ uri: item.image }} style={styles.shelfImage} contentFit="cover" />
                  <Text style={styles.shelfName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.shelfMeta}>{item.prepTime + item.cookTime}m</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Recommended — only when not filtering and pantry has items */}
        {!isFiltered && recommendedRecipes.length > 0 && (
          <View style={styles.shelfSection}>
            <View style={styles.shelfTitleRow}>
              <Text style={styles.shelfTitle}>Good Match for Your Pantry</Text>
              <Text style={styles.shelfTitleSub}>≥50% ingredients in stock</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfContent}>
              {recommendedRecipes.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/recipe/${item.id}`)}
                  style={({ pressed }) => [styles.shelfCard, pressed && { opacity: 0.82 }]}
                >
                  <Image source={{ uri: item.image }} style={styles.shelfImage} contentFit="cover" />
                  <View style={styles.shelfMatchBadge}>
                    <Ionicons name="leaf-outline" size={10} color="#8FAF7E" />
                  </View>
                  <Text style={styles.shelfName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.shelfMeta}>{item.prepTime + item.cookTime}m</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Results count */}
        <View style={styles.resultsMeta}>
          <Text style={styles.resultsCount}>
            {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''}
          </Text>
          <Pressable
            onPress={() => setSortOption((prev) => {
              const idx = SORT_OPTIONS.findIndex((s) => s.value === prev);
              return SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length].value;
            })}
            style={styles.sortButton}
          >
            <Ionicons name="swap-vertical-outline" size={14} color="#6B7280" />
            <Text style={styles.sortButtonText}>
              {SORT_OPTIONS.find((s) => s.value === sortOption)?.label ?? 'Sort'}
            </Text>
          </Pressable>
        </View>
      </View>
    ),
    [activeFilters, filteredRecipes.length, sortOption, toggleQuickFilter, isFiltered, recentRecipes, recommendedRecipes, router],
  );

  const ListEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No recipes found</Text>
        <Text style={styles.emptySubtitle}>Try adjusting your filters or search</Text>
      </View>
    ),
    [],
  );

  return (
    <View style={styles.container}>
      {/* Header: search + filters */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search-outline" size={18} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search recipes..."
              placeholderTextColor="#9CA3AF"
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
          <Pressable
            onPress={() => setShowFilterModal(true)}
            style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={activeFilterCount > 0 ? '#FFFFFF' : '#1A2B4A'}
            />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Recipe grid */}
      <FlatList
        data={filteredRecipes}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={2}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={isLoading ? null : ListEmptyComponent}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      />

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter & Sort</Text>
            <Pressable
              onPress={() => setShowFilterModal(false)}
              style={styles.modalCloseButton}
              accessibilityLabel="Close filters"
            >
              <Ionicons name="close" size={24} color="#1A2B4A" />
            </Pressable>
          </View>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {/* Category */}
            <Text style={styles.modalSectionTitle}>Category</Text>
            <View style={styles.optionGrid}>
              <Pressable
                key="all"
                onPress={() => setCategoryFilter(null)}
                style={[styles.optionChip, !categoryFilter && styles.optionChipActive]}
              >
                <Text style={[styles.optionChipText, !categoryFilter && styles.optionChipTextActive]}>
                  All
                </Text>
              </Pressable>
              {CATEGORY_OPTIONS.map((cat) => {
                const label = cat === 'ready-meal' ? 'Ready Meals'
                  : cat === 'stir-fry' ? 'Stir-fry'
                  : cat.charAt(0).toUpperCase() + cat.slice(1);
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                    style={[styles.optionChip, categoryFilter === cat && styles.optionChipActive]}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        categoryFilter === cat && styles.optionChipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Dietary */}
            <Text style={styles.modalSectionTitle}>Dietary</Text>
            <View style={styles.optionGrid}>
              {DIETARY_OPTIONS.map(({ key, label }) => {
                const isActive = dietaryFilters.has(key);
                return (
                  <Pressable
                    key={key}
                    onPress={() => toggleDietary(key)}
                    style={[styles.optionChip, isActive && styles.optionChipActive]}
                  >
                    <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Difficulty */}
            <Text style={styles.modalSectionTitle}>Difficulty</Text>
            <View style={styles.optionGrid}>
              {DIFFICULTY_OPTIONS.map(({ value, label }) => {
                const isActive = difficultyFilters.has(value);
                return (
                  <Pressable
                    key={value}
                    onPress={() => toggleDifficulty(value)}
                    style={[styles.optionChip, isActive && styles.optionChipActive]}
                  >
                    <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Exclude Allergens */}
            <Text style={styles.modalSectionTitle}>Exclude Allergens</Text>
            <View style={styles.optionGrid}>
              {(Object.keys(ALLERGEN_LABELS) as Allergen[]).map((allergen) => {
                const isExcluded = excludedAllergens.has(allergen);
                return (
                  <Pressable
                    key={allergen}
                    onPress={() => toggleAllergen(allergen)}
                    style={[styles.optionChip, isExcluded && styles.allergenChipExcluded]}
                  >
                    <Text style={[styles.optionChipText, isExcluded && styles.allergenChipTextExcluded]}>
                      {ALLERGEN_LABELS[allergen]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Sort */}
            <Text style={styles.modalSectionTitle}>Sort By</Text>
            <View style={styles.sortList}>
              {SORT_OPTIONS.map(({ value, label }) => (
                <Pressable
                  key={value}
                  onPress={() => setSortOption(value)}
                  style={[styles.sortRow, sortOption === value && styles.sortRowActive]}
                >
                  <Text
                    style={[styles.sortRowText, sortOption === value && styles.sortRowTextActive]}
                  >
                    {label}
                  </Text>
                  {sortOption === value && (
                    <Ionicons name="checkmark" size={18} color="#E8A020" />
                  )}
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setCategoryFilter(null);
                  setDietaryFilters(new Set());
                  setDifficultyFilters(new Set());
                  setExcludedAllergens(new Set());
                  setActiveFilters(new Set());
                  setSortOption('name');
                }}
                style={styles.clearButton}
              >
                <Text style={styles.clearButtonText}>Clear All</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowFilterModal(false)}
                style={styles.applyButton}
              >
                <Text style={styles.applyButtonText}>
                  Show {filteredRecipes.length} Result{filteredRecipes.length !== 1 ? 's' : ''}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  header: {
    backgroundColor: '#FAFAF8',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderColor: '#E5E7EB',
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 44,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A2B4A',
    height: 44,
  },
  filterButton: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderColor: '#E5E7EB',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterButtonActive: {
    backgroundColor: '#1A2B4A',
    borderColor: '#1A2B4A',
  },
  filterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#E8A020',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 9,
    color: '#1A2B4A',
    fontWeight: '800',
  },
  quickFiltersScroll: {
    marginTop: 10,
  },
  quickFiltersContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  quickFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderColor: '#E5E7EB',
    borderWidth: 1,
  },
  quickFilterChipActive: {
    backgroundColor: '#1A2B4A',
    borderColor: '#1A2B4A',
  },
  quickFilterText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  quickFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  resultsMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resultsCount: {
    fontSize: 13,
    color: '#6B7280',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortButtonText: {
    fontSize: 13,
    color: '#6B7280',
  },
  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A2B4A',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A2B4A',
    marginTop: 20,
    marginBottom: 10,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderColor: '#E5E7EB',
    borderWidth: 1,
  },
  optionChipActive: {
    backgroundColor: '#1A2B4A',
    borderColor: '#1A2B4A',
  },
  optionChipText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  optionChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sortList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderColor: '#E5E7EB',
    borderWidth: 1,
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomColor: '#F3F4F6',
    borderBottomWidth: 1,
  },
  sortRowActive: {
    backgroundColor: '#FFF9F0',
  },
  sortRowText: {
    fontSize: 14,
    color: '#374151',
  },
  sortRowTextActive: {
    color: '#E8A020',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 32,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderColor: '#E5E7EB',
    borderWidth: 1,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
  },
  applyButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1A2B4A',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  allergenChipExcluded: {
    backgroundColor: '#C0392B',
    borderColor: '#C0392B',
  },
  allergenChipTextExcluded: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  shelfSection: {
    paddingTop: 14,
    paddingBottom: 4,
  },
  shelfTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  shelfTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A2B4A',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  shelfTitleSub: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  shelfContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  shelfCard: {
    width: 110,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  shelfImage: {
    width: '100%',
    height: 72,
  },
  shelfMatchBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    padding: 3,
  },
  shelfName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A2B4A',
    padding: 7,
    paddingBottom: 2,
    lineHeight: 15,
  },
  shelfMeta: {
    fontSize: 10,
    color: '#9CA3AF',
    paddingHorizontal: 7,
    paddingBottom: 8,
  },
});
