import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  Pressable,
  Switch,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Alert,
  Share,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMealPlanStore } from '../../src/stores/useMealPlanStore';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { usePantryStore } from '../../src/stores/usePantryStore';
import { useFreezerStore } from '../../src/stores/useFreezerStore';
import { useShoppingExtrasStore } from '../../src/stores/useShoppingExtrasStore';
import { useShoppingCheckedStore } from '../../src/stores/useShoppingCheckedStore';
import { useRecipeLibrary } from '../../src/hooks/useRecipeLibrary';
import { buildShoppingList } from '../../src/utils/pricing';
import { usePriceStore } from '../../src/stores/usePriceStore';
import { ingredients as allIngredients } from '../../src/data/ingredients';
import SupermarketChip from '../../src/components/SupermarketChip';
import AllergenChip from '../../src/components/AllergenChip';
import BarcodeScanModal from '../../src/components/BarcodeScanModal';
import { BarcodeResult } from '../../src/services/openFoodFacts';
import {
  ShoppingListItem,
  IngredientCategory,
  Supermarket,
  AnyRecipe,
} from '../../src/types';

type GroupBy = 'category' | 'supermarket';

const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  meat: 'Meat & Fish',
  dairy: 'Dairy',
  vegetables: 'Fruit & Veg',
  'pasta-rice': 'Pasta, Rice & Grains',
  canned: 'Tins & Canned',
  spices: 'Spices & Herbs',
  bakery: 'Bakery',
  frozen: 'Frozen',
  condiments: 'Condiments & Sauces',
  'ready-meals': 'Ready Meals',
  other: 'Other',
};

interface SectionData {
  title: string;
  data: ShoppingListItem[];
}

export default function ShoppingScreen(): React.ReactElement {
  const [pantryDeduction, setPantryDeduction] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [manualItem, setManualItem] = useState('');
  const [manualItems, setManualItems] = useState<ShoppingListItem[]>([]);
  const [showScanModal, setShowScanModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShoppingListItem | null>(null);

  const priceOverrides = usePriceStore((s) => s.getPriceOverrides());

  const plans = useMealPlanStore((s) => s.plans);
  const getCurrentWeekKey = useMealPlanStore((s) => s.getCurrentWeekKey);
  const currentWeekKey = getCurrentWeekKey();

  const toggleCheckedPersist = useShoppingCheckedStore((s) => s.toggle);
  const clearCheckedForWeek = useShoppingCheckedStore((s) => s.clearForWeek);
  const uncheck = useShoppingCheckedStore((s) => s.uncheck);
  const storedCheckedIds = useShoppingCheckedStore((s) => s.checkedIds);
  const storedWeekKey = useShoppingCheckedStore((s) => s.weekKey);
  const checkedItems = useMemo(
    () => storedWeekKey === currentWeekKey ? new Set(storedCheckedIds) : new Set<string>(),
    [storedCheckedIds, storedWeekKey, currentWeekKey],
  );
  const familySize = useAuthStore((s) => s.familySize);
  const preferredSupermarket = useAuthStore((s) => s.preferredSupermarket);
  const pantryItems = usePantryStore((s) => s.items);
  const freezerItems = useFreezerStore((s) => s.items);
  const extraRecipeIds = useShoppingExtrasStore((s) => s.extraRecipeIds);
  const clearExtras = useShoppingExtrasStore((s) => s.clearExtras);
  const { recipes: allRecipes } = useRecipeLibrary();

  const currentPlan = plans[currentWeekKey];

  // Collect week recipes
  const weekRecipes = useMemo<AnyRecipe[]>(() => {
    if (!currentPlan) return [];
    const days = [
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    ] as const;
    return days
      .map((day) => {
        const id = currentPlan[day];
        if (!id) return null;
        return allRecipes.find((r) => r.id === id) ?? null;
      })
      .filter((r): r is AnyRecipe => r !== null);
  }, [currentPlan, allRecipes]);

  const pantryIngredientIds = useMemo<Set<string>>(() => {
    if (!pantryDeduction) return new Set();
    return new Set(
      pantryItems.filter((p) => p.inStock).map((p) => p.ingredientId),
    );
  }, [pantryDeduction, pantryItems]);

  // Recipes covered by a frozen meal — skip their ingredients from shopping
  const frozenRecipeIds = useMemo<Set<string>>(() => {
    const covered = new Set<string>();
    for (const item of freezerItems) {
      if (item.type === 'meal' && item.recipeId) {
        covered.add(item.recipeId);
      }
    }
    return covered;
  }, [freezerItems]);

  const recipesToShop = useMemo<AnyRecipe[]>(
    () => weekRecipes.filter((r) => !frozenRecipeIds.has(r.id)),
    [weekRecipes, frozenRecipeIds],
  );

  const frozenMealsDeducted = weekRecipes.length - recipesToShop.length;

  // Extra recipes added from recipe detail "Add to List" button
  const extraRecipes = useMemo<AnyRecipe[]>(() => {
    const weekIds = new Set(weekRecipes.map((r) => r.id));
    return extraRecipeIds
      .map((id) => allRecipes.find((r) => r.id === id))
      .filter((r): r is AnyRecipe => r != null && !weekIds.has(r.id));
  }, [extraRecipeIds, allRecipes, weekRecipes]);

  const allRecipesToShop = useMemo<AnyRecipe[]>(
    () => [...recipesToShop, ...extraRecipes],
    [recipesToShop, extraRecipes],
  );

  const shoppingList = useMemo<ShoppingListItem[]>(() => {
    const generated = buildShoppingList(
      allRecipesToShop,
      allIngredients,
      familySize,
      pantryDeduction ? pantryIngredientIds : undefined,
      preferredSupermarket,
      priceOverrides,
    );
    return [...generated, ...manualItems];
  }, [allRecipesToShop, familySize, pantryDeduction, pantryIngredientIds, manualItems, preferredSupermarket, priceOverrides]);

  const totalCost = useMemo(
    () => shoppingList.reduce((sum, item) => sum + item.cheapestPrice, 0),
    [shoppingList],
  );

  const savingsSummary = useMemo<number | null>(() => {
    if (groupBy !== 'supermarket' || shoppingList.length === 0) return null;
    const worstCase = shoppingList.reduce((sum, item) => {
      if (item.allPrices.length === 0) return sum + item.cheapestPrice;
      return sum + Math.max(...item.allPrices.map((p) => p.price));
    }, 0);
    const saving = worstCase - totalCost;
    return saving > 0.01 ? saving : null;
  }, [shoppingList, groupBy, totalCost]);

  const sections = useMemo<SectionData[]>(() => {
    if (groupBy === 'category') {
      const categoryOrder: IngredientCategory[] = [
        'meat', 'dairy', 'vegetables', 'pasta-rice', 'canned',
        'spices', 'bakery', 'frozen', 'ready-meals', 'condiments', 'other',
      ];
      return categoryOrder
        .map((cat) => ({
          title: CATEGORY_LABELS[cat],
          data: shoppingList.filter((item) => item.category === cat),
        }))
        .filter((s) => s.data.length > 0);
    } else {
      const supermarkets: Supermarket[] = [
        'Tesco', "Sainsbury's", 'Asda', 'Morrisons', 'Lidl', 'Aldi',
      ];
      return supermarkets
        .map((sm) => ({
          title: sm,
          data: shoppingList.filter((item) => item.cheapestSupermarket === sm),
        }))
        .filter((s) => s.data.length > 0);
    }
  }, [shoppingList, groupBy]);

  const toggleChecked = useCallback((ingredientId: string) => {
    toggleCheckedPersist(ingredientId, currentWeekKey);
  }, [toggleCheckedPersist, currentWeekKey]);

  const handleAddManual = useCallback(() => {
    const trimmed = manualItem.trim();
    if (!trimmed) return;
    const newItem: ShoppingListItem = {
      ingredientId: `manual-${Date.now()}`,
      ingredientName: trimmed,
      totalQuantity: 1,
      unit: 'item',
      category: 'other',
      cheapestSupermarket: 'Tesco',
      cheapestPrice: 0,
      unitLabel: '',
      allPrices: [],
      allergens: [],
      fromRecipes: [],
      checked: false,
      isAdHoc: true,
    };
    setManualItems((prev) => [...prev, newItem]);
    setManualItem('');
  }, [manualItem]);

  const handleScanResult = useCallback((result: BarcodeResult) => {
    const matched = result.matchedIngredientId
      ? allIngredients.find((i) => i.id === result.matchedIngredientId)
      : null;

    const newItem: ShoppingListItem = {
      ingredientId: matched?.id ?? `scan-${Date.now()}`,
      ingredientName: matched?.name ?? result.productName,
      totalQuantity: 1,
      unit: matched?.unitType ?? 'item',
      category: matched?.category ?? 'other',
      cheapestSupermarket: 'Tesco',
      cheapestPrice: 0,
      unitLabel: '',
      allPrices: [],
      allergens: matched?.allergens ?? [],
      fromRecipes: [],
      checked: false,
      isAdHoc: true,
    };
    setManualItems((prev) => [...prev, newItem]);
  }, []);

  const handleClearCompleted = useCallback(() => {
    clearCheckedForWeek(currentWeekKey);
    setManualItems((prev) =>
      prev.filter((item) => !checkedItems.has(item.ingredientId)),
    );
  }, [clearCheckedForWeek, currentWeekKey, checkedItems]);

  const handleShare = useCallback(async () => {
    const lines: string[] = ['Shopping List\n'];
    for (const section of sections) {
      const sectionTotal = section.data.reduce((s, i) => s + i.cheapestPrice, 0);
      const totalStr = sectionTotal > 0 ? ` — £${sectionTotal.toFixed(2)}` : '';
      lines.push(`\n== ${section.title}${totalStr} ==`);
      for (const item of section.data) {
        const checked = checkedItems.has(item.ingredientId) ? '✓ ' : '  ';
        const price = item.cheapestPrice > 0 ? ` (£${item.cheapestPrice.toFixed(2)})` : '';
        lines.push(`${checked}${item.ingredientName} — ${item.totalQuantity}${item.unit}${price}`);
      }
    }
    lines.push(`\nEstimated Total: £${totalCost.toFixed(2)}`);
    const text = lines.join('\n');

    try {
      await Share.share({ message: text, title: 'Shopping List' });
    } catch (error) {
      console.error('[Shopping] share error:', error);
      Alert.alert('Shopping List', text);
    }
  }, [sections, checkedItems, totalCost]);

  const removeManualItem = useCallback((ingredientId: string) => {
    setManualItems((prev) => prev.filter((i) => i.ingredientId !== ingredientId));
    uncheck(ingredientId, currentWeekKey);
  }, [uncheck, currentWeekKey]);

  const renderItem = useCallback(
    ({ item }: { item: ShoppingListItem }) => {
      const isChecked = checkedItems.has(item.ingredientId);
      return (
        <Pressable
          onPress={() => toggleChecked(item.ingredientId)}
          style={({ pressed }) => [
            styles.itemRow,
            pressed && styles.itemRowPressed,
          ]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isChecked }}
          accessibilityLabel={item.ingredientName}
        >
          <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
            {isChecked && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.itemInfo}>
            <Text style={[styles.itemName, isChecked && styles.itemNameStrike]}>
              {item.ingredientName}
            </Text>
            <Text style={styles.itemQty}>
              {item.totalQuantity} {item.unit}
              {item.unitLabel ? ` (${item.unitLabel})` : ''}
            </Text>
            {item.allergens.length > 0 && (
              <View style={styles.allergenRow}>
                {item.allergens.slice(0, 3).map((a) => (
                  <AllergenChip key={a} allergen={a} small />
                ))}
              </View>
            )}
          </View>
          <View style={styles.itemRight}>
            <Pressable
              onPress={() => item.allPrices.length > 0 ? setSelectedItem(item) : undefined}
              hitSlop={6}
              accessibilityLabel={`Compare prices for ${item.ingredientName}`}
            >
              <SupermarketChip
                supermarket={item.cheapestSupermarket}
                price={item.cheapestPrice > 0 ? item.cheapestPrice : undefined}
                small
              />
            </Pressable>
            {item.isAdHoc && (
              <Pressable
                onPress={() => removeManualItem(item.ingredientId)}
                style={styles.removeManualBtn}
                accessibilityLabel={`Remove ${item.ingredientName}`}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color="#C0392B" />
              </Pressable>
            )}
          </View>
        </Pressable>
      );
    },
    [checkedItems, toggleChecked, removeManualItem],
  );

  const checkedCount = shoppingList.filter((item) => checkedItems.has(item.ingredientId)).length;
  const totalItemCount = shoppingList.length;
  const checkPercent = totalItemCount > 0 ? (checkedCount / totalItemCount) * 100 : 0;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Cost banner */}
      <View style={styles.costBanner}>
        <Text style={styles.costBannerText}>
          Estimated Total: £{totalCost.toFixed(2)}
        </Text>
        {totalItemCount > 0 && (
          <View style={styles.checkProgressRow}>
            <View style={styles.checkProgressBg}>
              <View
                style={[
                  styles.checkProgressFill,
                  { width: `${checkPercent}%` as `${number}%` },
                ]}
              />
            </View>
            <Text style={styles.checkProgressText}>
              {checkedCount} / {totalItemCount} checked
            </Text>
          </View>
        )}
        {frozenMealsDeducted > 0 && (
          <Text style={styles.costBannerSub}>
            ❄️ {frozenMealsDeducted} frozen meal{frozenMealsDeducted !== 1 ? 's' : ''} deducted
          </Text>
        )}
        {extraRecipes.length > 0 && (
          <View style={styles.extrasBanner}>
            <Text style={styles.extrasText}>
              + {extraRecipes.length} extra recipe{extraRecipes.length !== 1 ? 's' : ''} added
            </Text>
            <Pressable onPress={clearExtras} style={styles.extrasClearBtn}>
              <Text style={styles.extrasClearText}>Clear</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.pantryRow}>
          <Text style={styles.pantryLabel}>Pantry Deduction</Text>
          <Switch
            value={pantryDeduction}
            onValueChange={setPantryDeduction}
            trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#8FAF7E' }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={styles.segmentRow}>
          <Pressable
            onPress={() => setGroupBy('category')}
            style={[
              styles.segmentBtn,
              groupBy === 'category' && styles.segmentBtnActive,
            ]}
          >
            <Text
              style={[
                styles.segmentBtnText,
                groupBy === 'category' && styles.segmentBtnTextActive,
              ]}
            >
              By Category
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setGroupBy('supermarket')}
            style={[
              styles.segmentBtn,
              groupBy === 'supermarket' && styles.segmentBtnActive,
            ]}
          >
            <Text
              style={[
                styles.segmentBtnText,
                groupBy === 'supermarket' && styles.segmentBtnTextActive,
              ]}
            >
              Smart Shop
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Smart Shop savings banner */}
      {savingsSummary !== null && (
        <View style={styles.savingsBanner}>
          <Text style={styles.savingsBannerText}>
            Smart shopping saves you{' '}
            <Text style={styles.savingsBannerAmount}>£{savingsSummary.toFixed(2)}</Text>
            {' '}vs buying everything at one store
          </Text>
        </View>
      )}

      {/* Main list */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.ingredientId}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => {
          const sectionTotal = section.data.reduce((sum: number, i: ShoppingListItem) => sum + i.cheapestPrice, 0);
          const count = section.data.length;
          return (
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionHeaderText}>{section.title}</Text>
                <Text style={styles.sectionHeaderCount}>{count} item{count !== 1 ? 's' : ''}</Text>
              </View>
              {sectionTotal > 0 && (
                <Text style={styles.sectionHeaderCost}>£{sectionTotal.toFixed(2)}</Text>
              )}
            </View>
          );
        }}
        stickySectionHeadersEnabled
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No items — add recipes to your planner first.
          </Text>
        }
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          <View style={styles.footer}>
            {/* Manual add */}
            <View style={styles.manualRow}>
              <TextInput
                style={styles.manualInput}
                placeholder="Add item manually…"
                placeholderTextColor="#9CA3AF"
                value={manualItem}
                onChangeText={setManualItem}
                onSubmitEditing={handleAddManual}
                returnKeyType="done"
              />
              <Pressable
                onPress={handleAddManual}
                style={({ pressed }) => [
                  styles.manualAddBtn,
                  pressed && styles.manualAddBtnPressed,
                ]}
              >
                <Text style={styles.manualAddBtnText}>Add</Text>
              </Pressable>
            </View>

            {/* Scan to Add */}
            <Pressable
              onPress={() => setShowScanModal(true)}
              style={({ pressed }) => [styles.scanToAddBtn, pressed && styles.scanToAddBtnPressed]}
            >
              <Ionicons name="barcode-outline" size={18} color="#1A2B4A" />
              <Text style={styles.scanToAddBtnText}>Scan to Add Item</Text>
            </Pressable>

            {/* Bottom actions */}
            <View style={styles.bottomActions}>
              <Pressable
                onPress={() => void handleShare()}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnPrimary,
                  pressed && styles.actionBtnPressed,
                ]}
              >
                <Text style={[styles.actionBtnText, styles.actionBtnTextLight]}>Share List</Text>
              </Pressable>
              <Pressable
                onPress={handleClearCompleted}
                style={({ pressed }) => [
                  styles.actionBtn,
                  pressed && styles.actionBtnPressed,
                ]}
              >
                <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>
                  Clear Completed
                </Text>
              </Pressable>
            </View>
          </View>
        }
      />

      <BarcodeScanModal
        visible={showScanModal}
        action="shopping"
        onClose={() => setShowScanModal(false)}
        onResult={handleScanResult}
      />

      <PriceComparisonModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </SafeAreaView>
  );
}

const SUPERMARKET_COLOURS: Record<string, string> = {
  Tesco: '#EE1C2E',
  "Sainsbury's": '#FF6B00',
  Asda: '#78BE20',
  Morrisons: '#FFD700',
  Lidl: '#0050AA',
  Aldi: '#00529B',
};

function PriceComparisonModal({
  item,
  onClose,
}: {
  item: ShoppingListItem | null;
  onClose: () => void;
}) {
  if (!item) return null;
  const cheapest = item.allPrices[0]?.price ?? 0;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={pcStyles.backdrop} onPress={onClose} />
      <View style={pcStyles.sheet}>
        <View style={pcStyles.handle} />
        <Text style={pcStyles.title}>{item.ingredientName}</Text>
        <Text style={pcStyles.subtitle}>Price comparison — cheapest first</Text>
        <ScrollView style={pcStyles.list} showsVerticalScrollIndicator={false}>
          {item.allPrices.map((p, i) => {
            const diff = p.price - cheapest;
            const colour = SUPERMARKET_COLOURS[p.supermarket] ?? '#9CA3AF';
            return (
              <View key={p.supermarket} style={[pcStyles.row, i === 0 && pcStyles.rowCheapest]}>
                <View style={[pcStyles.dot, { backgroundColor: colour }]} />
                <Text style={pcStyles.store}>{p.supermarket}</Text>
                <Text style={pcStyles.unitLabel}>{p.unitLabel}</Text>
                <View style={pcStyles.priceCol}>
                  <Text style={[pcStyles.price, i === 0 && pcStyles.priceCheapest]}>
                    £{p.price.toFixed(2)}
                  </Text>
                  {i === 0 ? (
                    <View style={pcStyles.badge}>
                      <Text style={pcStyles.badgeText}>CHEAPEST</Text>
                    </View>
                  ) : (
                    <Text style={pcStyles.diff}>+£{diff.toFixed(2)}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
        <Pressable style={pcStyles.closeBtn} onPress={onClose}>
          <Text style={pcStyles.closeBtnText}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const pcStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#1A2B4A', marginBottom: 2 },
  subtitle: { fontSize: 12, color: '#9CA3AF', marginBottom: 16 },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 10,
  },
  rowCheapest: { backgroundColor: '#F0FBF4', borderRadius: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  store: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1A2B4A' },
  unitLabel: { fontSize: 12, color: '#9CA3AF', maxWidth: 80 },
  priceCol: { alignItems: 'flex-end', gap: 2 },
  price: { fontSize: 15, fontWeight: '700', color: '#1A2B4A' },
  priceCheapest: { color: '#2E7D32' },
  badge: { backgroundColor: '#2E7D32', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  diff: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  closeBtn: {
    marginTop: 16,
    backgroundColor: '#1A2B4A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  costBanner: {
    backgroundColor: '#1A2B4A',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  costBannerText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  costBannerSub: {
    color: '#A5C8FF',
    fontSize: 12,
    marginTop: 2,
  },
  checkProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    width: '100%',
  },
  checkProgressBg: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  checkProgressFill: {
    height: '100%',
    backgroundColor: '#8FAF7E',
    borderRadius: 3,
  },
  checkProgressText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    minWidth: 70,
    textAlign: 'right',
  },
  extrasBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 10,
  },
  extrasText: {
    color: '#E8A020',
    fontSize: 12,
    fontWeight: '600',
  },
  extrasClearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E8A020',
  },
  extrasClearText: {
    color: '#E8A020',
    fontSize: 11,
    fontWeight: '700',
  },
  controls: {
    backgroundColor: '#1A2B4A',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 10,
  },
  pantryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pantryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
  },
  segmentBtnTextActive: {
    color: '#1A2B4A',
    fontWeight: '700',
  },
  savingsBanner: {
    backgroundColor: '#F0FBF4',
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6C9',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  savingsBannerText: {
    fontSize: 13,
    color: '#2E7D32',
    textAlign: 'center',
    lineHeight: 18,
  },
  savingsBannerAmount: {
    fontWeight: '800',
    fontSize: 14,
  },
  sectionHeader: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeaderCount: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  sectionHeaderCost: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  listContent: {
    paddingBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  itemRowPressed: {
    backgroundColor: '#F9F9F7',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#8FAF7E',
    borderColor: '#8FAF7E',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  itemInfo: {
    flex: 1,
    gap: 3,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2B4A',
  },
  itemNameStrike: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  itemQty: {
    fontSize: 12,
    color: '#6B7280',
  },
  allergenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  removeManualBtn: {
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  manualRow: {
    flexDirection: 'row',
    gap: 10,
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A2B4A',
  },
  manualAddBtn: {
    backgroundColor: '#1A2B4A',
    borderRadius: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualAddBtnPressed: {
    opacity: 0.75,
  },
  manualAddBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  actionBtnPrimary: {
    backgroundColor: '#1A2B4A',
    borderColor: '#1A2B4A',
  },
  actionBtnPressed: {
    opacity: 0.75,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  actionBtnTextLight: {
    color: '#FFFFFF',
  },
  actionBtnTextDanger: {
    color: '#C0392B',
  },
  scanToAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EEF1F7',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 12,
  },
  scanToAddBtnPressed: {
    opacity: 0.7,
  },
  scanToAddBtnText: {
    color: '#1A2B4A',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 40,
    paddingHorizontal: 32,
    lineHeight: 22,
  },
});
