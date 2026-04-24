import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, Modal,
  StyleSheet, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { theMealDBService, ExternalRecipe } from '../../../src/services/recipeApi';
import { useRecipeDataStore } from '../../../src/stores/useRecipeDataStore';
import { useAuthStore } from '../../../src/stores/useAuthStore';
import { ingredients } from '../../../src/data/ingredients';
import { fuzzyMatch } from '../../../src/utils/fuzzyMatch';
import { ImportedRecipe } from '../../../src/types';

interface MatchedIngredient {
  original: string;
  measure: string;
  matchedId: string | null;
  matchedName: string | null;
  score: number;
}

export default function RecipeSearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExternalRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ExternalRecipe | null>(null);
  const [matched, setMatched] = useState<MatchedIngredient[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const { addImportedRecipe } = useRecipeDataStore();
  const { user } = useAuthStore();

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await theMealDBService.searchByName(query.trim());
      setResults(res);
      if (res.length === 0) setError('No recipes found. Try a different search term.');
    } catch {
      setError('Couldn\'t reach the recipe database. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  const handleRandom = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const recipe = await theMealDBService.getRandom();
      if (recipe) setResults([recipe]);
    } catch {
      setError('Couldn\'t load a random recipe. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const openImport = (recipe: ExternalRecipe) => {
    const matchResults: MatchedIngredient[] = recipe.ingredients.map((ing) => {
      let bestScore = 0;
      let bestId: string | null = null;
      let bestName: string | null = null;
      for (const local of ingredients) {
        const score = fuzzyMatch(ing.name, local.name);
        if (score > bestScore) { bestScore = score; bestId = local.id; bestName = local.name; }
      }
      return {
        original: ing.name,
        measure: ing.measure,
        matchedId: bestScore >= 0.7 ? bestId : null,
        matchedName: bestScore >= 0.7 ? bestName : null,
        score: bestScore,
      };
    });
    setMatched(matchResults);
    setSelected(recipe);
  };

  const handleImport = async () => {
    if (!selected || !user) return;
    setIsImporting(true);
    try {
      const importedRecipe: ImportedRecipe = {
        id: `imported-${selected.externalId}-${Date.now()}`,
        name: selected.name,
        description: `Imported from TheMealDB. Category: ${selected.category}`,
        category: 'bake',
        tags: [selected.category, selected.area ?? ''].filter(Boolean),
        servesBase: 4 as const,
        prepTime: 20,
        cookTime: 40,
        difficulty: 'medium',
        image: selected.image,
        ingredients: matched.map((m, i) => ({
          ingredientId: m.matchedId ?? `custom-${i}`,
          quantityPer4: 1,
          unit: m.measure || 'item',
          notes: m.matchedId ? undefined : m.original,
        })),
        steps: selected.instructions.split('\n').filter(Boolean).map((s, i) => ({
          stepNumber: i + 1,
          instruction: s.trim(),
        })),
        nutritionPer4: null,
        dietaryInfo: { vegetarian: false, vegan: false, glutenFree: false, dairyFree: false },
        allergens: [],
        freezerFriendly: false,
        onePot: false,
        kidFriendly: false,
        source: 'themealdb',
        externalId: selected.externalId,
        importedAt: new Date().toISOString(),
        userId: user.id,
      };
      await addImportedRecipe(importedRecipe);
      setSelected(null);
      Alert.alert('Imported!', `${selected.name} has been added to your recipe library.`);
    } catch {
      Alert.alert('Error', 'Failed to import recipe. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Find New Recipes' }} />
      <View style={styles.container}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search recipes…"
            returnKeyType="search"
            onSubmitEditing={search}
            placeholderTextColor="#9CA3AF"
          />
          <Pressable style={styles.searchBtn} onPress={search}>
            <Ionicons name="search" size={20} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.actionsRow}>
          <Pressable style={styles.actionBtn} onPress={handleRandom}>
            <Text style={styles.actionBtnText}>🎲 Random Recipe</Text>
          </Pressable>
        </View>

        {isLoading && <ActivityIndicator color="#E8A020" size="large" style={styles.loader} />}
        {error && !isLoading && (
          <View style={styles.emptyState}>
            <Ionicons name="wifi-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        )}
        {!isLoading && !error && results.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>Search for recipes or tap Random Recipe to get started.</Text>
          </View>
        )}

        <FlatList
          data={results}
          keyExtractor={(item) => item.externalId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable style={styles.resultRow} onPress={() => openImport(item)}>
              <Image source={{ uri: item.image }} style={styles.thumbnail} contentFit="cover" />
              <View style={styles.resultInfo}>
                <Text style={styles.resultName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.resultCategory}>{item.category}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </Pressable>
          )}
        />
      </View>

      {/* Import Modal */}
      <Modal visible={!!selected} animationType="slide">
        <View style={styles.modalContainer}>
          {selected && (
            <>
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setSelected(null)}>
                  <Ionicons name="close" size={24} color="#1A2B4A" />
                </Pressable>
                <Text style={styles.modalTitle} numberOfLines={1}>{selected.name}</Text>
                <View style={{ width: 24 }} />
              </View>
              <ScrollView>
                <Image source={{ uri: selected.image }} style={styles.modalImage} contentFit="cover" />
                <View style={styles.modalContent}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{selected.category}</Text>
                  </View>
                  <Text style={styles.instructionsPreview} numberOfLines={4}>{selected.instructions}</Text>
                  <Text style={styles.matchTitle}>Ingredient Matching</Text>
                  {matched.map((m, i) => (
                    <View key={i} style={styles.matchRow}>
                      <View style={[styles.matchDot, { backgroundColor: m.matchedId ? '#8FAF7E' : '#E8A020' }]} />
                      <View style={styles.matchInfo}>
                        <Text style={styles.matchOriginal}>{m.original}</Text>
                        {m.matchedName
                          ? <Text style={styles.matchedName}>✓ Matched: {m.matchedName}</Text>
                          : <Text style={styles.unmatchedName}>Will be imported as-is</Text>
                        }
                      </View>
                      <Text style={styles.matchMeasure}>{m.measure}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
              <Pressable style={styles.importBtn} onPress={handleImport} disabled={isImporting}>
                {isImporting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.importBtnText}>Import to My Library</Text>
                }
              </Pressable>
            </>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  searchRow: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  searchInput: { flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#1A2B4A' },
  searchBtn: { backgroundColor: '#1A2B4A', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  actionsRow: { paddingHorizontal: 16, paddingBottom: 8 },
  actionBtn: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start' },
  actionBtnText: { color: '#1A2B4A', fontWeight: '600' },
  loader: { marginTop: 40 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  emptyText: { color: '#9CA3AF', textAlign: 'center', fontSize: 15, lineHeight: 22 },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  resultRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, marginBottom: 10, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  thumbnail: { width: 80, height: 80 },
  resultInfo: { flex: 1, padding: 12 },
  resultName: { fontSize: 15, fontWeight: '600', color: '#1A2B4A' },
  resultCategory: { fontSize: 12, color: '#6B7280', marginTop: 3 },
  modalContainer: { flex: 1, backgroundColor: '#FAFAF8' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingTop: 52 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1A2B4A', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  modalImage: { width: '100%', height: 220 },
  modalContent: { padding: 16 },
  categoryBadge: { backgroundColor: '#EFF6FF', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  categoryBadgeText: { color: '#1D4ED8', fontWeight: '600', fontSize: 12 },
  instructionsPreview: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 16 },
  matchTitle: { fontSize: 16, fontWeight: '700', color: '#1A2B4A', marginBottom: 10 },
  matchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  matchDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  matchInfo: { flex: 1 },
  matchOriginal: { fontSize: 14, fontWeight: '600', color: '#1A2B4A' },
  matchedName: { fontSize: 12, color: '#8FAF7E', marginTop: 2 },
  unmatchedName: { fontSize: 12, color: '#E8A020', marginTop: 2 },
  matchMeasure: { fontSize: 12, color: '#6B7280' },
  importBtn: { margin: 16, backgroundColor: '#E8A020', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  importBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
