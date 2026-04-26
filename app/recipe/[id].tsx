import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal, StyleSheet,
  Alert, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRecipeLibrary } from '../../src/hooks/useRecipeLibrary';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { usePantryStore } from '../../src/stores/usePantryStore';
import { useFavouritesStore } from '../../src/stores/useFavouritesStore';
import { useMealPlanStore } from '../../src/stores/useMealPlanStore';
import { useRecipeDataStore } from '../../src/stores/useRecipeDataStore';
import { useShoppingExtrasStore } from '../../src/stores/useShoppingExtrasStore';
import { useAllergenCheck } from '../../src/hooks/useAllergenCheck';
import { getIngredientById, ingredients as allIngredients } from '../../src/data/ingredients';
import { getDealsForIngredient } from '../../src/data/deals';
import { ALLERGEN_LABELS } from '../../src/utils/allergens';
import { calculateRecipeCost } from '../../src/utils/pricing';
import { calculateRecipeNutrition, getNutritionLabel } from '../../src/utils/nutrition';
import FamilySizeSelector from '../../src/components/FamilySizeSelector';
import SupermarketChip from '../../src/components/SupermarketChip';
import AllergenChip from '../../src/components/AllergenChip';
import { Allergen, CustomRecipe, ImportedRecipe, WeeklyMealPlan } from '../../src/types';

const DAYS: (keyof Omit<WeeklyMealPlan, 'id' | 'userId' | 'weekKey'>)[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getRecipeById } = useRecipeLibrary();
  const { familySize } = useAuthStore();
  const { items: pantryItems } = usePantryStore();
  const { favourites, ratings, toggleFavourite, setRating } = useFavouritesStore();
  const { getCurrentWeekKey, setMeal } = useMealPlanStore();
  const { deleteCustomRecipe, deleteImportedRecipe, addCustomRecipe } = useRecipeDataStore();
  const addExtraRecipe = useShoppingExtrasStore((s) => s.addExtraRecipe);
  const extraRecipeIds = useShoppingExtrasStore((s) => s.extraRecipeIds);
  const { conflicts } = useAllergenCheck(id ?? '');

  const [showDayPicker, setShowDayPicker] = useState(false);
  const [dayPickerMode, setDayPickerMode] = useState<'plan' | 'batchcook'>('plan');

  const recipe = getRecipeById(id ?? '');

  if (!recipe) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Recipe not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const recipeSource = 'source' in recipe ? (recipe as { source: string }).source : null;
  const isCustom = recipeSource === 'custom';
  const isImported = recipeSource !== null && recipeSource !== 'custom';

  const handleDelete = () => {
    Alert.alert(
      'Delete Recipe',
      `Remove "${recipe.name}" from your library? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (isCustom) void deleteCustomRecipe(recipe.id);
            else void deleteImportedRecipe(recipe.id);
            router.back();
          },
        },
      ],
    );
  };

  const handleDuplicate = () => {
    const now = new Date().toISOString();
    const copy: CustomRecipe = {
      ...(recipe as CustomRecipe),
      id: `custom-${Date.now()}`,
      name: `Copy of ${recipe.name}`,
      source: 'custom',
      createdAt: now,
      updatedAt: now,
      userId: (recipe as CustomRecipe).userId ?? '',
    };
    void addCustomRecipe(copy);
    Alert.alert('Duplicated', `"${copy.name}" has been added to My Recipes.`);
  };

  const handleOptions = () => {
    const buttons: Parameters<typeof Alert.alert>[2] = [];
    if (isCustom) {
      buttons.push({
        text: 'Edit Recipe',
        onPress: () => router.push(`/(tabs)/recipes/create?editId=${recipe.id}`),
      });
    }
    buttons.push({ text: 'Duplicate', onPress: handleDuplicate });
    buttons.push({ text: 'Delete', style: 'destructive', onPress: handleDelete });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(recipe.name, undefined, buttons);
  };

  const openAddToPlan = (mode: 'plan' | 'batchcook') => {
    setDayPickerMode(mode);
    setShowDayPicker(true);
  };

  const isFav = favourites[recipe.id] ?? false;
  const myRating = ratings[recipe.id] ?? 0;
  const totalCost = calculateRecipeCost(recipe, allIngredients, familySize);
  const costPerPerson = familySize > 0 ? totalCost / familySize : 0;
  const scale = familySize / 4;
  const pantryIds = new Set(pantryItems.filter((p) => p.inStock).map((p) => p.ingredientId));
  const ingredientBreakdown = recipe.ingredients.map((ri) => {
    const ingredient = getIngredientById(ri.ingredientId);
    if (!ingredient) return null;
    const inPantry = pantryIds.has(ri.ingredientId);
    let cheapestSupermarket = ingredient.prices[0]?.supermarket ?? ('Tesco' as const);
    let cheapestPrice = ingredient.prices[0]?.pricePerUnit ?? 0;
    for (const p of ingredient.prices) {
      if (p.pricePerUnit < cheapestPrice) { cheapestPrice = p.pricePerUnit; cheapestSupermarket = p.supermarket; }
    }
    const scaledCost = cheapestPrice * ((ri.quantityPer4 * scale) / ingredient.baseQuantityPer4);
    const deals = getDealsForIngredient(ri.ingredientId);
    const deal = deals[0] ?? null;
    return {
      ingredientId: ri.ingredientId,
      ingredientName: ingredient.name,
      scaledQuantity: Math.ceil(ri.quantityPer4 * scale),
      unit: ri.unit,
      allergens: ingredient.allergens,
      inPantry,
      cheapestSupermarket,
      cheapestPrice: scaledCost,
      onOffer: deal !== null,
      dealLabel: deal?.dealLabel ?? '',
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);
  const nutrition = calculateRecipeNutrition(recipe, familySize);
  const perPerson = nutrition
    ? { calories: nutrition.calories / familySize, protein: nutrition.protein / familySize,
        carbs: nutrition.carbs / familySize, fat: nutrition.fat / familySize }
    : null;

  const difficultyColor =
    recipe.difficulty === 'easy' ? '#8FAF7E' :
    recipe.difficulty === 'medium' ? '#E8A020' : '#C0392B';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <View style={styles.heroContainer}>
          <Image source={{ uri: recipe.image }} style={styles.heroImage} contentFit="cover" />
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          {(isCustom || isImported) && (
            <Pressable onPress={handleOptions} style={styles.optionsButton}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
            </Pressable>
          )}
        </View>

        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title}>{recipe.name}</Text>
          <Text style={styles.description}>{recipe.description}</Text>

          {/* Badges row */}
          <View style={styles.badgesRow}>
            <View style={[styles.difficultyBadge, { backgroundColor: difficultyColor }]}>
              <Text style={styles.badgeText}>{recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}</Text>
            </View>
            <View style={styles.timeBadge}>
              <Ionicons name="time-outline" size={14} color="#1A2B4A" />
              <Text style={styles.timeText}>{recipe.prepTime + recipe.cookTime} mins</Text>
            </View>
            {recipe.freezerFriendly && (
              <View style={styles.freezerBadge}><Text>❄️ Freezer-friendly</Text></View>
            )}
          </View>

          {/* Dietary */}
          <View style={styles.dietRow}>
            {recipe.dietaryInfo.vegetarian && <View style={styles.dietChip}><Text style={styles.dietChipText}>Vegetarian</Text></View>}
            {recipe.dietaryInfo.vegan && <View style={styles.dietChip}><Text style={styles.dietChipText}>Vegan</Text></View>}
            {recipe.dietaryInfo.glutenFree && <View style={styles.dietChip}><Text style={styles.dietChipText}>Gluten-Free</Text></View>}
            {recipe.dietaryInfo.dairyFree && <View style={styles.dietChip}><Text style={styles.dietChipText}>Dairy-Free</Text></View>}
          </View>

          <FamilySizeSelector />

          {/* Allergen conflicts */}
          {conflicts.length > 0 && (
            <View style={styles.conflictsBox}>
              <Text style={styles.conflictTitle}>⚠️ Family member conflicts</Text>
              {conflicts.map((c) => (
                <Text key={c.memberId} style={styles.conflictRow}>
                  {c.memberName}: {c.conflictType === 'allergen' ? '🚨 allergen conflict' : '👎 dislikes some ingredients'}
                </Text>
              ))}
            </View>
          )}

          {/* Cost Breakdown */}
          <Text style={styles.sectionHeader}>Ingredient Cost Breakdown</Text>
          {ingredientBreakdown.map((row) => (
            <View key={row.ingredientId} style={styles.ingredientRow}>
              <View style={styles.ingredientLeft}>
                <Text style={styles.ingredientName}>{row.ingredientName}</Text>
                <Text style={styles.ingredientQty}>{row.scaledQuantity} {row.unit}</Text>
                {row.allergens.length > 0 && (
                  <View style={styles.allergenDots}>
                    {row.allergens.slice(0, 3).map((a) => (
                      <AllergenChip key={a} allergen={a as Allergen} small />
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.ingredientRight}>
                {row.inPantry ? (
                  <Text style={styles.inPantryText}>✓ In Pantry</Text>
                ) : (
                  <>
                    <SupermarketChip supermarket={row.cheapestSupermarket} price={row.cheapestPrice} small />
                    {row.onOffer && (
                      <Text style={styles.dealText}>🏷 {row.dealLabel}</Text>
                    )}
                  </>
                )}
              </View>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>£{totalCost.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Per person</Text>
            <Text style={styles.totalValue}>£{costPerPerson.toFixed(2)}</Text>
          </View>
          <Text style={styles.disclaimer}>Prices are approximate and based on 2024/2025 UK supermarket data. Always check current prices in store.</Text>

          {/* Allergens */}
          <Text style={styles.sectionHeader}>Allergens</Text>
          {recipe.allergens.length === 0 ? (
            <View style={styles.noAllergenBadge}><Text style={styles.noAllergenText}>✓ No Major Allergens</Text></View>
          ) : (
            <View style={styles.allergenRow}>
              {recipe.allergens.map((a) => (
                <AllergenChip key={a} allergen={a as Allergen} />
              ))}
            </View>
          )}
          <Text style={styles.disclaimer}>Allergen information is provided as a guide only. Always check product labels when shopping. If you have a severe allergy, consult a healthcare professional.</Text>

          {/* Nutrition */}
          {perPerson && (
            <>
              <Text style={styles.sectionHeader}>Nutrition (per person)</Text>
              <View style={styles.nutritionGrid}>
                {[
                  { label: 'Calories', value: Math.round(perPerson.calories), unit: 'kcal' },
                  { label: 'Protein', value: Math.round(perPerson.protein), unit: 'g' },
                  { label: 'Carbs', value: Math.round(perPerson.carbs), unit: 'g' },
                  { label: 'Fat', value: Math.round(perPerson.fat), unit: 'g' },
                ].map((n) => (
                  <View key={n.label} style={styles.nutritionBox}>
                    <Text style={styles.nutritionValue}>{n.value}{n.unit}</Text>
                    <Text style={styles.nutritionLabel}>{n.label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.macroBar}>
                <View style={[styles.macroSegment, { flex: perPerson.protein, backgroundColor: '#4A90D9' }]} />
                <View style={[styles.macroSegment, { flex: perPerson.carbs, backgroundColor: '#E8A020' }]} />
                <View style={[styles.macroSegment, { flex: perPerson.fat, backgroundColor: '#C0392B' }]} />
              </View>
              <Text style={styles.nutritionNote}>
                {getNutritionLabel(perPerson.calories, perPerson.protein)} · Nutritional values are approximate estimates.
              </Text>
            </>
          )}

          {/* Freezer & Batch Cook */}
          {recipe.freezerFriendly && (
            <>
              <Text style={styles.sectionHeader}>❄️ Freezer & Batch Cook</Text>
              {recipe.batchCookNotes && (
                <Text style={styles.batchNotes}>{recipe.batchCookNotes}</Text>
              )}
              <Pressable
                style={({ pressed }) => [styles.batchCookBtn, pressed && styles.batchCookBtnPressed]}
                onPress={() => openAddToPlan('batchcook')}
              >
                <Ionicons name="snow-outline" size={18} color="#1A2B4A" />
                <Text style={styles.batchCookBtnText}>Add to Batch Cook Plan</Text>
              </Pressable>
            </>
          )}

          {/* Steps */}
          <Text style={styles.sectionHeader}>Method</Text>
          {recipe.steps.map((step) => (
            <View key={step.stepNumber} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{step.stepNumber}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepInstruction}>{step.instruction}</Text>
                {step.tip && (
                  <View style={styles.tipBox}>
                    <Text style={styles.tipText}>💡 {step.tip}</Text>
                  </View>
                )}
                {step.duration && (
                  <Text style={styles.stepDuration}>⏱ {step.duration} mins</Text>
                )}
              </View>
            </View>
          ))}

          <Pressable style={styles.cookingBtn} onPress={() => router.push(`/recipe/cooking/${recipe.id}`)}>
            <Text style={styles.cookingBtnText}>Start Cooking</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Sticky bottom bar */}
      <View style={styles.stickyBar}>
        <Pressable style={styles.stickyBtn} onPress={() => openAddToPlan('plan')}>
          <Ionicons name="calendar-outline" size={20} color="#1A2B4A" />
          <Text style={styles.stickyBtnText}>Add to Plan</Text>
        </Pressable>
        <Pressable
          style={styles.stickyBtn}
          onPress={() => {
            addExtraRecipe(recipe.id);
            const alreadyAdded = extraRecipeIds.includes(recipe.id);
            Alert.alert(
              alreadyAdded ? 'Already on list' : 'Added to list!',
              alreadyAdded
                ? `${recipe.name} is already on your shopping list.`
                : `${recipe.name}'s ingredients added to your shopping list.`,
            );
          }}
        >
          <Ionicons
            name={extraRecipeIds.includes(recipe.id) ? 'cart' : 'cart-outline'}
            size={20}
            color={extraRecipeIds.includes(recipe.id) ? '#E8A020' : '#1A2B4A'}
          />
          <Text style={styles.stickyBtnText}>Add to List</Text>
        </Pressable>
        <Pressable style={styles.stickyBtn} onPress={() => toggleFavourite(recipe.id)}>
          <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={20} color={isFav ? '#C0392B' : '#1A2B4A'} />
          <Text style={styles.stickyBtnText}>Favourite</Text>
        </Pressable>
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(recipe.id, n)}>
              <Ionicons name={n <= myRating ? 'star' : 'star-outline'} size={22} color="#E8A020" />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Day picker modal */}
      <Modal visible={showDayPicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowDayPicker(false)}>
          <View style={styles.dayPickerSheet}>
            <Text style={styles.dayPickerTitle}>
              {dayPickerMode === 'batchcook' ? '❄️ Batch Cook — which day?' : 'Add to which day?'}
            </Text>
            {DAYS.map((day, i) => (
              <Pressable
                key={day}
                style={styles.dayRow}
                onPress={() => {
                  setMeal(getCurrentWeekKey(), day, recipe.id);
                  setShowDayPicker(false);
                  Alert.alert(
                    dayPickerMode === 'batchcook' ? 'Added to Batch Cook Plan' : 'Added!',
                    dayPickerMode === 'batchcook'
                      ? `${recipe.name} added for ${DAY_LABELS[i]}. Open the Planner to see your double-batch cost estimate.`
                      : `${recipe.name} added to ${DAY_LABELS[i]}.`,
                  );
                }}
              >
                <Text style={styles.dayRowText}>{DAY_LABELS[i]}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.cancelBtn} onPress={() => setShowDayPicker(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAF8' },
  notFoundText: { fontSize: 18, color: '#1A2B4A', marginBottom: 16 },
  backBtn: { backgroundColor: '#E8A020', padding: 12, borderRadius: 8 },
  backBtnText: { color: '#fff', fontWeight: '700' },
  heroContainer: { position: 'relative' },
  heroImage: { width: '100%', height: 280, backgroundColor: '#E5E7EB' },
  backButton: { position: 'absolute', top: 48, left: 16, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 22, padding: 8 },
  optionsButton: { position: 'absolute', top: 48, right: 16, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 22, padding: 8 },
  content: { padding: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#1A2B4A', marginBottom: 6 },
  description: { fontSize: 15, color: '#555', marginBottom: 12, lineHeight: 22 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  difficultyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  timeText: { fontSize: 12, color: '#1A2B4A' },
  freezerBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  dietRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  dietChip: { backgroundColor: '#8FAF7E', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  dietChipText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  conflictsBox: { backgroundColor: '#FEF3C7', borderRadius: 8, padding: 12, marginVertical: 10 },
  conflictTitle: { fontWeight: '700', color: '#92400E', marginBottom: 4 },
  conflictRow: { fontSize: 13, color: '#92400E' },
  sectionHeader: { fontSize: 18, fontWeight: '700', color: '#1A2B4A', marginTop: 24, marginBottom: 12 },
  ingredientRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  ingredientLeft: { flex: 1 },
  ingredientName: { fontSize: 14, color: '#1A2B4A', fontWeight: '600' },
  ingredientQty: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  allergenDots: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 4 },
  ingredientRight: { alignItems: 'flex-end', gap: 4 },
  inPantryText: { color: '#8FAF7E', fontWeight: '700', fontSize: 12 },
  dealText: { color: '#8FAF7E', fontSize: 11, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 4 },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#1A2B4A' },
  totalValue: { fontSize: 15, fontWeight: '700', color: '#1A2B4A' },
  disclaimer: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', marginTop: 8, lineHeight: 16 },
  noAllergenBadge: { backgroundColor: '#8FAF7E', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start' },
  noAllergenText: { color: '#fff', fontWeight: '700' },
  allergenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  nutritionGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  nutritionBox: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  nutritionValue: { fontSize: 16, fontWeight: '800', color: '#1A2B4A' },
  nutritionLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  macroBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  macroSegment: { height: 8 },
  nutritionNote: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  batchNotes: { fontSize: 14, color: '#374151', lineHeight: 20, backgroundColor: '#EFF6FF', padding: 12, borderRadius: 8, marginBottom: 10 },
  batchCookBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#BFDBFE' },
  batchCookBtnPressed: { opacity: 0.75 },
  batchCookBtnText: { fontSize: 14, fontWeight: '700', color: '#1A2B4A' },
  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  stepNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E8A020', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  stepNumberText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  stepContent: { flex: 1 },
  stepInstruction: { fontSize: 15, color: '#374151', lineHeight: 22 },
  tipBox: { backgroundColor: '#FEF3C7', borderRadius: 6, padding: 8, marginTop: 6 },
  tipText: { fontSize: 13, color: '#92400E' },
  stepDuration: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  cookingBtn: { backgroundColor: '#1A2B4A', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  cookingBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 12, borderTopWidth: 1, borderTopColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 8 },
  stickyBtn: { alignItems: 'center', gap: 3 },
  stickyBtnText: { fontSize: 11, color: '#1A2B4A', fontWeight: '600' },
  starRow: { flexDirection: 'row', gap: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  dayPickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  dayPickerTitle: { fontSize: 18, fontWeight: '700', color: '#1A2B4A', marginBottom: 16, textAlign: 'center' },
  dayRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dayRowText: { fontSize: 16, color: '#1A2B4A', textAlign: 'center' },
  cancelBtn: { marginTop: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 16, color: '#C0392B', fontWeight: '600' },
});
