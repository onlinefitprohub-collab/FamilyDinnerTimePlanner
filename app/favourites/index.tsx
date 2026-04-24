import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFavouritesStore } from '../../src/stores/useFavouritesStore';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { useRecipeLibrary } from '../../src/hooks/useRecipeLibrary';
import RecipeCard from '../../src/components/RecipeCard';
import { AnyRecipe } from '../../src/types';

type ActiveTab = 'favourites' | 'top-rated';
type SortBy = 'cost' | 'time' | 'rating' | 'name';

import { calculateRecipeCost } from '../../src/utils/pricing';
import { ingredients as allIngredients } from '../../src/data/ingredients';

export default function FavouritesScreen(): React.ReactElement {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('favourites');
  const [sortBy, setSortBy] = useState<SortBy>('rating');

  const favourites = useFavouritesStore((s) => s.favourites);
  const ratings = useFavouritesStore((s) => s.ratings);
  const toggleFavourite = useFavouritesStore((s) => s.toggleFavourite);

  const familySize = useAuthStore((s) => s.familySize);
  const { recipes: allRecipes } = useRecipeLibrary();

  const sortRecipes = (recipes: AnyRecipe[]): AnyRecipe[] => {
    return [...recipes].sort((a, b) => {
      switch (sortBy) {
        case 'cost': {
          const costA = calculateRecipeCost(a, allIngredients, familySize);
          const costB = calculateRecipeCost(b, allIngredients, familySize);
          return costA - costB;
        }
        case 'time':
          return (a.prepTime + a.cookTime) - (b.prepTime + b.cookTime);
        case 'rating': {
          const rA = ratings[a.id] ?? 0;
          const rB = ratings[b.id] ?? 0;
          return rB - rA;
        }
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  };

  const favouriteRecipes = useMemo(() => {
    const filtered = allRecipes.filter((r) => favourites[r.id] === true);
    return sortRecipes(filtered);
  }, [allRecipes, favourites, sortBy, familySize]);

  const topRatedRecipes = useMemo(() => {
    const withRatings = allRecipes.filter(
      (r) => ratings[r.id] !== undefined && ratings[r.id] > 0,
    );
    return sortRecipes(withRatings);
  }, [allRecipes, ratings, sortBy, familySize]);

  const displayRecipes = activeTab === 'favourites' ? favouriteRecipes : topRatedRecipes;

  const SORT_OPTIONS: { key: SortBy; label: string }[] = [
    { key: 'cost', label: 'Cost' },
    { key: 'time', label: 'Time' },
    { key: 'rating', label: 'Rating' },
    { key: 'name', label: 'A-Z' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Tabs */}
      <View style={styles.tabRow}>
        <Pressable
          onPress={() => setActiveTab('favourites')}
          style={[styles.tab, activeTab === 'favourites' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'favourites' && styles.tabTextActive]}>
            Favourites
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('top-rated')}
          style={[styles.tab, activeTab === 'top-rated' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'top-rated' && styles.tabTextActive]}>
            Top Rated
          </Text>
        </Pressable>
      </View>

      {/* Sort controls */}
      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => setSortBy(opt.key)}
            style={[styles.sortChip, sortBy === opt.key && styles.sortChipActive]}
          >
            <Text
              style={[
                styles.sortChipText,
                sortBy === opt.key && styles.sortChipTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={displayRecipes}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            familySize={familySize}
            onPress={() => router.push(`/recipe/${item.id}` as Parameters<typeof router.push>[0])}
            onFavouriteToggle={() => void toggleFavourite(item.id)}
            isFavourite={favourites[item.id] === true}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>
              {activeTab === 'favourites' ? '❤️' : '⭐'}
            </Text>
            <Text style={styles.emptyTitle}>
              {activeTab === 'favourites'
                ? 'No favourites yet'
                : 'No rated recipes yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'favourites'
                ? 'Tap the heart icon on any recipe to add it here.'
                : 'Rate recipes from the recipe detail page.'}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#E8A020',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#1A2B4A',
  },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9F9F7',
  },
  sortChipActive: {
    backgroundColor: '#1A2B4A',
    borderColor: '#1A2B4A',
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  sortChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 8,
    paddingBottom: 32,
  },
  columnWrapper: {
    gap: 0,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2B4A',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
  },
});
