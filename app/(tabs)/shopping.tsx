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
  Platform,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useMealPlanStore } from '../../src/stores/useMealPlanStore';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { usePantryStore } from '../../src/stores/usePantryStore';
import { useRecipeLibrary } from '../../src/hooks/useRecipeLibrary';
import { buildShoppingList } from '../../src/utils/pricing';
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
  other: 'Other',
};

interface SectionData {
  title: string;
  data: ShoppingListItem[];
}

export default function ShoppingScreen(): React.ReactElement {
  const [pantryDeduction, setPantryDeduction] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [manualItem, setManualItem] = useState('');
  const [manualItems, setManualItems] = useState<ShoppingListItem[]>([]);
  const [showScanModal, setShowScanModal] = useState(false);

  const plans = useMealPlanStore((s) => s.plans);
  const currentWeekKey = useMealPlanStore((s) => s.currentWeekKey);
  const familySize = useAuthStore((s) => s.familySize);
  const pantryItems = usePantryStore((s) => s.items);
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

  const shoppingList = useMemo<ShoppingListItem[]>(() => {
    const generated = buildShoppingList(
      weekRecipes,
      allIngredients,
      familySize,
      pantryDeduction ? pantryIngredientIds : undefined,
    );
    return [...generated, ...manualItems];
  }, [weekRecipes, familySize, pantryDeduction, pantryIngredientIds, manualItems]);

  const totalCost = useMemo(
    () => shoppingList.reduce((sum, item) => sum + item.cheapestPrice, 0),
    [shoppingList],
  );

  const sections = useMemo<SectionData[]>(() => {
    if (groupBy === 'category') {
      const categoryOrder: IngredientCategory[] = [
        'meat', 'dairy', 'vegetables', 'pasta-rice', 'canned',
        'spices', 'bakery', 'frozen', 'condiments', 'other',
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
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(ingredientId)) {
        next.delete(ingredientId);
      } else {
        next.add(ingredientId);
      }
      return next;
    });
  }, []);

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
      allergens: matched?.allergens ?? [],
      fromRecipes: [],
      checked: false,
      isAdHoc: true,
    };
    setManualItems((prev) => [...prev, newItem]);
  }, []);

  const handleClearCompleted = useCallback(() => {
    setCheckedItems(new Set());
    setManualItems((prev) =>
      prev.filter((item) => !checkedItems.has(item.ingredientId)),
    );
  }, [checkedItems]);

  const handleShare = useCallback(async () => {
    const lines: string[] = ['Shopping List\n'];
    for (const section of sections) {
      lines.push(`\n== ${section.title} ==`);
      for (const item of section.data) {
        const checked = checkedItems.has(item.ingredientId) ? '✓ ' : '  ';
        const price = item.cheapestPrice > 0 ? ` (£${item.cheapestPrice.toFixed(2)})` : '';
        lines.push(`${checked}${item.ingredientName} — ${item.totalQuantity}${item.unit}${price}`);
      }
    }
    lines.push(`\nEstimated Total: £${totalCost.toFixed(2)}`);
    const text = lines.join('\n');

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing not available', text);
        return;
      }
      // Write to a temp file and share — for simplicity show an alert on web
      if (Platform.OS === 'web') {
        Alert.alert('Shopping List', text);
      } else {
        const FileSystem = await import('expo-file-system');
        const fileUri = `${FileSystem.cacheDirectory}shopping-list.txt`;
        await FileSystem.writeAsStringAsync(fileUri, text, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        await Sharing.shareAsync(fileUri, { mimeType: 'text/plain' });
      }
    } catch (error) {
      console.error('[Shopping] share error:', error);
      Alert.alert('Shopping List', text);
    }
  }, [sections, checkedItems, totalCost]);

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
            <SupermarketChip
              supermarket={item.cheapestSupermarket}
              price={item.cheapestPrice > 0 ? item.cheapestPrice : undefined}
              small
            />
          </View>
        </Pressable>
      );
    },
    [checkedItems, toggleChecked],
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Cost banner */}
      <View style={styles.costBanner}>
        <Text style={styles.costBannerText}>
          Estimated Total: £{totalCost.toFixed(2)}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.pantryRow}>
          <Text style={styles.pantryLabel}>Pantry Deduction</Text>
          <Switch
            value={pantryDeduction}
            onValueChange={setPantryDeduction}
            trackColor={{ false: '#D1D5DB', true: '#8FAF7E' }}
            thumbColor={pantryDeduction ? '#FFFFFF' : '#F9FAFB'}
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
              By Supermarket
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Main list */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.ingredientId}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
          </View>
        )}
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
                <Text style={styles.actionBtnText}>Share List</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  costBanner: {
    backgroundColor: '#1A2B4A',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  costBannerText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  controls: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
    color: '#1A2B4A',
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
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
    color: '#6B7280',
  },
  segmentBtnTextActive: {
    color: '#1A2B4A',
    fontWeight: '700',
  },
  sectionHeader: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
