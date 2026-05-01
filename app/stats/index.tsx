import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCookHistoryStore } from '../../src/stores/useCookHistoryStore';
import { useFavouritesStore } from '../../src/stores/useFavouritesStore';
import { useRecipeLibrary } from '../../src/hooks/useRecipeLibrary';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { AnyRecipe } from '../../src/types';

interface RecipeStat {
  recipe: AnyRecipe;
  count: number;
  lastCooked: string;
}

function daysBetween(a: string, b: string): number {
  return Math.abs(
    Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000),
  );
}

function formatRelative(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function StatsScreen(): React.ReactElement {
  const router = useRouter();
  const history = useCookHistoryStore((s) => s.history);
  const totalCooks = useCookHistoryStore((s) => s.totalCooks());
  const { recipes } = useRecipeLibrary();
  const ratings = useFavouritesStore((s) => s.ratings);
  const familySize = useAuthStore((s) => s.familySize);

  // Top recipes by cook count
  const topRecipes = useMemo<RecipeStat[]>(() => {
    return Object.entries(history)
      .map(([recipeId, dates]) => {
        const recipe = recipes.find((r) => r.id === recipeId);
        if (!recipe || dates.length === 0) return null;
        return { recipe, count: dates.length, lastCooked: dates[0] };
      })
      .filter((r): r is RecipeStat => r !== null)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [history, recipes]);

  // Longest cooking streak (consecutive days with at least one cook)
  const streak = useMemo<{ current: number; longest: number }>(() => {
    const allDates = new Set<string>();
    for (const dates of Object.values(history)) {
      for (const d of dates) {
        allDates.add(new Date(d).toISOString().split('T')[0]);
      }
    }
    const sorted = Array.from(allDates).sort().reverse();
    if (sorted.length === 0) return { current: 0, longest: 0 };

    let current = 0;
    let longest = 0;
    let run = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Current streak starting from today or yesterday
    const startIdx = sorted[0] === today || sorted[0] === yesterday ? 0 : -1;
    if (startIdx >= 0) {
      run = 1;
      for (let i = 1; i < sorted.length; i++) {
        if (daysBetween(sorted[i - 1], sorted[i]) === 1) {
          run++;
        } else {
          break;
        }
      }
      current = run;
    }

    // Longest streak (scan full history)
    run = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (daysBetween(sorted[i - 1], sorted[i]) === 1) {
        run++;
      } else {
        longest = Math.max(longest, run);
        run = 1;
      }
    }
    longest = Math.max(longest, run);

    return { current, longest };
  }, [history]);

  // Unique recipes cooked
  const uniqueCount = Object.keys(history).filter((id) => history[id].length > 0).length;

  // Average rating across cooked recipes
  const avgRating = useMemo<number>(() => {
    const cooked = Object.keys(history).filter((id) => history[id].length > 0);
    const rated = cooked.filter((id) => ratings[id] > 0);
    if (rated.length === 0) return 0;
    const sum = rated.reduce((acc, id) => acc + ratings[id], 0);
    return Math.round((sum / rated.length) * 10) / 10;
  }, [history, ratings]);

  // Estimated total cooking time (rough: avg 35 mins per cook)
  const estimatedHours = Math.round((totalCooks * 35) / 60);

  const hasData = totalCooks > 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Kitchen Stats',
          headerStyle: { backgroundColor: '#1A2B4A' },
          headerTitleStyle: { color: '#FFFFFF' },
          headerTintColor: '#FFFFFF',
        }}
      />
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {!hasData ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🍳</Text>
              <Text style={styles.emptyTitle}>No cooks recorded yet</Text>
              <Text style={styles.emptySubtitle}>
                Complete your first cooking session to start tracking your kitchen stats.
              </Text>
              <Pressable
                onPress={() => router.push('/(tabs)/recipes')}
                style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.emptyBtnText}>Browse Recipes</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Hero stat */}
              <View style={styles.heroCard}>
                <Text style={styles.heroNumber}>{totalCooks}</Text>
                <Text style={styles.heroLabel}>
                  {totalCooks === 1 ? 'Dinner Cooked' : 'Dinners Cooked'}
                </Text>
                <Text style={styles.heroSub}>
                  ~{estimatedHours}h in the kitchen · {uniqueCount} different {uniqueCount === 1 ? 'recipe' : 'recipes'}
                </Text>
              </View>

              {/* Stat grid */}
              <View style={styles.statGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>🔥</Text>
                  <Text style={styles.statValue}>{streak.current}</Text>
                  <Text style={styles.statLabel}>Day streak</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>🏆</Text>
                  <Text style={styles.statValue}>{streak.longest}</Text>
                  <Text style={styles.statLabel}>Longest streak</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>⭐</Text>
                  <Text style={styles.statValue}>{avgRating > 0 ? avgRating : '—'}</Text>
                  <Text style={styles.statLabel}>Avg rating</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>👨‍👩‍👧‍👦</Text>
                  <Text style={styles.statValue}>{familySize}</Text>
                  <Text style={styles.statLabel}>People fed</Text>
                </View>
              </View>

              {/* Top recipes */}
              {topRecipes.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Most Cooked</Text>
                  {topRecipes.map((stat, index) => (
                    <Pressable
                      key={stat.recipe.id}
                      onPress={() => router.push(`/recipe/${stat.recipe.id}` as Parameters<typeof router.push>[0])}
                      style={({ pressed }) => [styles.recipeRow, pressed && { opacity: 0.85 }]}
                    >
                      <Text style={styles.rank}>#{index + 1}</Text>
                      <Image
                        source={{ uri: stat.recipe.image }}
                        style={styles.recipeThumb}
                        contentFit="cover"
                      />
                      <View style={styles.recipeInfo}>
                        <Text style={styles.recipeName} numberOfLines={1}>
                          {stat.recipe.name}
                        </Text>
                        <Text style={styles.recipeMeta}>
                          {stat.count} {stat.count === 1 ? 'cook' : 'cooks'} · last {formatRelative(stat.lastCooked)}
                        </Text>
                        {ratings[stat.recipe.id] > 0 && (
                          <View style={styles.ratingRow}>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Text
                                key={i}
                                style={[styles.star, i < ratings[stat.recipe.id] && styles.starFilled]}
                              >
                                {i < ratings[stat.recipe.id] ? '★' : '☆'}
                              </Text>
                            ))}
                          </View>
                        )}
                      </View>
                      <View style={styles.cookBadge}>
                        <Text style={styles.cookBadgeText}>{stat.count}×</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 56,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A2B4A',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 24,
  },
  emptyBtn: {
    marginTop: 12,
    backgroundColor: '#1A2B4A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  emptyBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  heroCard: {
    backgroundColor: '#1A2B4A',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 4,
  },
  heroNumber: {
    fontSize: 72,
    fontWeight: '900',
    color: '#E8A020',
    lineHeight: 80,
  },
  heroLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    textAlign: 'center',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    fontSize: 26,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A2B4A',
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A2B4A',
    marginBottom: 4,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  rank: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E8A020',
    width: 28,
    textAlign: 'center',
  },
  recipeThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  recipeInfo: {
    flex: 1,
    gap: 2,
  },
  recipeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  recipeMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 1,
    marginTop: 2,
  },
  star: {
    fontSize: 11,
    color: '#D1D5DB',
  },
  starFilled: {
    color: '#E8A020',
  },
  cookBadge: {
    backgroundColor: '#EEF1F7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cookBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A2B4A',
  },
});
