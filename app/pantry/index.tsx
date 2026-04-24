import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  FlatList,
  Pressable,
  Switch,
  TextInput,
  Modal,
  Alert,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePantryStore } from '../../src/stores/usePantryStore';
import { useFreezerStore } from '../../src/stores/useFreezerStore';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { useRecipeLibrary } from '../../src/hooks/useRecipeLibrary';
import { scoreRecipeByPantry } from '../../src/utils/pricing';
import { ingredients as allIngredients } from '../../src/data/ingredients';
import { Ingredient, FreezerItem, IngredientCategory, AnyRecipe } from '../../src/types';

type CupboardTab = 'cupboard' | 'freezer';
type MatchFilter = '100' | '1-2';

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

const CATEGORY_ORDER: IngredientCategory[] = [
  'meat', 'dairy', 'vegetables', 'pasta-rice', 'canned',
  'spices', 'bakery', 'frozen', 'condiments', 'other',
];

function getDaysInFreezer(frozenAt: string): number {
  const frozenDate = new Date(frozenAt);
  const now = new Date();
  return Math.floor((now.getTime() - frozenDate.getTime()) / 86400000);
}

export default function PantryScreen(): React.ReactElement {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CupboardTab>('cupboard');
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('100');
  const [showAddFreezerModal, setShowAddFreezerModal] = useState(false);

  // Freezer form state
  const [freezerLabel, setFreezerLabel] = useState('');
  const [freezerType, setFreezerType] = useState<'meal' | 'ingredient'>('meal');
  const [freezerPortions, setFreezerPortions] = useState('');
  const [freezerQuantity, setFreezerQuantity] = useState('');
  const [freezerDate, setFreezerDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [freezerUseBy, setFreezerUseBy] = useState('');

  const pantryItems = usePantryStore((s) => s.items);
  const toggleInStock = usePantryStore((s) => s.toggleInStock);
  const clearAll = usePantryStore((s) => s.clearAll);

  const freezerItems = useFreezerStore((s) => s.items);
  const addFreezerItem = useFreezerStore((s) => s.addItem);
  const removeFreezerItem = useFreezerStore((s) => s.removeItem);

  const familySize = useAuthStore((s) => s.familySize);
  const user = useAuthStore((s) => s.user);

  const { recipes: allRecipes } = useRecipeLibrary();

  const pantryIngredientIds = useMemo<Set<string>>(
    () => new Set(pantryItems.filter((p) => p.inStock).map((p) => p.ingredientId)),
    [pantryItems],
  );

  // Build sections for cupboard
  const cupboardSections = useMemo(() => {
    const lowStockItems: Ingredient[] = [];
    const byCat: Partial<Record<IngredientCategory, Ingredient[]>> = {};

    for (const ing of allIngredients) {
      const pantryItem = pantryItems.find((p) => p.ingredientId === ing.id);
      if (pantryItem?.isLowStock) {
        lowStockItems.push(ing);
      } else {
        const cat = ing.category;
        if (!byCat[cat]) byCat[cat] = [];
        byCat[cat]!.push(ing);
      }
    }

    const sections: { title: string; data: Ingredient[] }[] = [];
    if (lowStockItems.length > 0) {
      sections.push({ title: 'Running Low', data: lowStockItems });
    }
    for (const cat of CATEGORY_ORDER) {
      const items = byCat[cat];
      if (items && items.length > 0) {
        sections.push({ title: CATEGORY_LABELS[cat], data: items });
      }
    }
    return sections;
  }, [pantryItems]);

  // Scored recipes for suggestions
  const scoredRecipes = useMemo(() => {
    return allRecipes
      .map((recipe) =>
        scoreRecipeByPantry(recipe, allIngredients, pantryIngredientIds, familySize),
      )
      .filter((s) => {
        if (matchFilter === '100') return s.coveragePercent === 100;
        return s.totalCount - s.coveredCount <= 2;
      })
      .sort((a, b) => b.coveragePercent - a.coveragePercent);
  }, [allRecipes, pantryIngredientIds, familySize, matchFilter]);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear Pantry',
      'Remove all pantry items? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => void clearAll(),
        },
      ],
    );
  }, [clearAll]);

  const handleAddFreezerItem = useCallback(() => {
    if (!freezerLabel.trim()) {
      Alert.alert('Missing info', 'Please enter a label for the freezer item.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to add freezer items.');
      return;
    }
    const newItem: Omit<FreezerItem, 'id'> = {
      userId: user.id,
      label: freezerLabel.trim(),
      type: freezerType,
      portions: freezerType === 'meal' && freezerPortions ? parseInt(freezerPortions, 10) : undefined,
      quantity: freezerType === 'ingredient' && freezerQuantity ? parseFloat(freezerQuantity) : undefined,
      frozenAt: freezerDate || new Date().toISOString(),
      useByDate: freezerUseBy || undefined,
    };
    void addFreezerItem(newItem);
    // Reset form
    setFreezerLabel('');
    setFreezerType('meal');
    setFreezerPortions('');
    setFreezerQuantity('');
    setFreezerDate(new Date().toISOString().split('T')[0]);
    setFreezerUseBy('');
    setShowAddFreezerModal(false);
  }, [
    freezerLabel, freezerType, freezerPortions, freezerQuantity,
    freezerDate, freezerUseBy, user, addFreezerItem,
  ]);

  const renderIngredient = useCallback(
    ({ item }: { item: Ingredient }) => {
      const pantryItem = pantryItems.find((p) => p.ingredientId === item.id);
      const inStock = pantryItem?.inStock ?? false;
      const isLow = pantryItem?.isLowStock ?? false;

      return (
        <View style={styles.ingredientRow}>
          {inStock && (
            <Ionicons name="checkmark-circle" size={18} color="#8FAF7E" />
          )}
          {!inStock && (
            <Ionicons name="ellipse-outline" size={18} color="#D1D5DB" />
          )}
          <View style={styles.ingredientInfo}>
            <Text style={styles.ingredientName}>{item.name}</Text>
            {isLow && (
              <Text style={styles.lowStockLabel}>Low Stock</Text>
            )}
          </View>
          {inStock && (
            <TextInput
              style={styles.quantityInput}
              placeholder="Qty"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              defaultValue={pantryItem?.quantity?.toString() ?? ''}
              onEndEditing={(e) => {
                const qty = parseFloat(e.nativeEvent.text);
                void toggleInStock(item.id, isNaN(qty) ? 1 : qty);
              }}
            />
          )}
          <Switch
            value={inStock}
            onValueChange={() => void toggleInStock(item.id)}
            trackColor={{ false: '#D1D5DB', true: '#8FAF7E' }}
            thumbColor={inStock ? '#FFFFFF' : '#F9FAFB'}
          />
        </View>
      );
    },
    [pantryItems, toggleInStock],
  );

  const renderFreezerItem = useCallback(
    ({ item }: { item: FreezerItem }) => {
      const days = getDaysInFreezer(item.frozenAt);
      const isOld = days > 80;
      return (
        <View style={[styles.freezerRow, isOld && styles.freezerRowOld]}>
          <View style={styles.freezerInfo}>
            <View style={styles.freezerTitleRow}>
              <Text style={styles.freezerLabel}>{item.label}</Text>
              <View style={[styles.typeBadge, item.type === 'meal' && styles.typeBadgeMeal]}>
                <Text style={styles.typeBadgeText}>{item.type}</Text>
              </View>
            </View>
            <Text style={styles.freezerMeta}>
              {item.type === 'meal'
                ? `${item.portions ?? '?'} portions`
                : `${item.quantity ?? '?'} units`}
              {' · '}Frozen {new Date(item.frozenAt).toLocaleDateString()}
            </Text>
            {item.useByDate && (
              <Text style={styles.freezerUseBy}>
                Use by: {new Date(item.useByDate).toLocaleDateString()}
              </Text>
            )}
            {isOld && (
              <Text style={styles.oldWarning}>⚠ Over 80 days frozen</Text>
            )}
          </View>
          <Pressable
            onPress={() => void removeFreezerItem(item.id)}
            style={({ pressed }) => [
              styles.removeBtn,
              pressed && styles.removeBtnPressed,
            ]}
            accessibilityLabel={`Remove ${item.label}`}
          >
            <Ionicons name="trash-outline" size={18} color="#C0392B" />
          </Pressable>
        </View>
      );
    },
    [removeFreezerItem],
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Tab selector */}
      <View style={styles.tabRow}>
        <Pressable
          onPress={() => setActiveTab('cupboard')}
          style={[styles.tab, activeTab === 'cupboard' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'cupboard' && styles.tabTextActive]}>
            Cupboard
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('freezer')}
          style={[styles.tab, activeTab === 'freezer' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'freezer' && styles.tabTextActive]}>
            Freezer
          </Text>
        </Pressable>
      </View>

      {activeTab === 'cupboard' ? (
        <>
          {/* Action buttons */}
          <View style={styles.cupboardActions}>
            <Pressable
              onPress={() => setShowSuggestionsModal(true)}
              style={({ pressed }) => [
                styles.suggestBtn,
                pressed && styles.suggestBtnPressed,
              ]}
            >
              <Ionicons name="bulb-outline" size={18} color="#1A2B4A" />
              <Text style={styles.suggestBtnText}>What Can I Make?</Text>
            </Pressable>
            <Pressable
              onPress={handleClearAll}
              style={({ pressed }) => [styles.clearBtn, pressed && styles.clearBtnPressed]}
            >
              <Text style={styles.clearBtnText}>Clear All</Text>
            </Pressable>
          </View>

          <SectionList
            sections={cupboardSections}
            keyExtractor={(item) => item.id}
            renderItem={renderIngredient}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{section.title}</Text>
              </View>
            )}
            stickySectionHeadersEnabled
            ListEmptyComponent={
              <Text style={styles.emptyText}>No ingredients found.</Text>
            }
            contentContainerStyle={styles.listContent}
          />
        </>
      ) : (
        <>
          {/* Add to freezer */}
          <View style={styles.freezerHeaderRow}>
            <Text style={styles.freezerCount}>
              {freezerItems.length} item{freezerItems.length !== 1 ? 's' : ''}
            </Text>
            <Pressable
              onPress={() => setShowAddFreezerModal(true)}
              style={({ pressed }) => [
                styles.addFreezerBtn,
                pressed && styles.addFreezerBtnPressed,
              ]}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addFreezerBtnText}>Add to Freezer</Text>
            </Pressable>
          </View>
          <FlatList
            data={freezerItems}
            keyExtractor={(item) => item.id}
            renderItem={renderFreezerItem}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No freezer items. Add one above.</Text>
            }
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </>
      )}

      {/* Leftover Suggestions Modal */}
      <Modal
        visible={showSuggestionsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSuggestionsModal(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>What Can I Make?</Text>
            <Pressable
              onPress={() => setShowSuggestionsModal(false)}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Match filter */}
          <View style={styles.matchFilterRow}>
            <Pressable
              onPress={() => setMatchFilter('100')}
              style={[
                styles.filterChip,
                matchFilter === '100' && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  matchFilter === '100' && styles.filterChipTextActive,
                ]}
              >
                100% match
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMatchFilter('1-2')}
              style={[
                styles.filterChip,
                matchFilter === '1-2' && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  matchFilter === '1-2' && styles.filterChipTextActive,
                ]}
              >
                1–2 missing
              </Text>
            </Pressable>
          </View>

          <FlatList
            data={scoredRecipes}
            keyExtractor={(item) => item.recipe.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setShowSuggestionsModal(false);
                  router.push(`/recipe/${item.recipe.id}` as Parameters<typeof router.push>[0]);
                }}
                style={({ pressed }) => [
                  styles.suggestionRow,
                  pressed && styles.suggestionRowPressed,
                ]}
              >
                <View style={styles.suggestionInfo}>
                  <Text style={styles.suggestionName}>{item.recipe.name}</Text>
                  <Text style={styles.suggestionMeta}>
                    {item.coveredCount}/{item.totalCount} ingredients
                    {item.missingCost > 0
                      ? ` · Buy missing for £${item.missingCost.toFixed(2)}`
                      : ''}
                  </Text>
                  <View style={styles.coverageBarBg}>
                    <View
                      style={[
                        styles.coverageBarFill,
                        {
                          width: `${item.coveragePercent}%` as `${number}%`,
                          backgroundColor:
                            item.coveragePercent === 100 ? '#8FAF7E' : '#E8A020',
                        },
                      ]}
                    />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {matchFilter === '100'
                  ? 'No recipes match 100% of your pantry.'
                  : 'No recipes with only 1–2 missing ingredients.'}
              </Text>
            }
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </SafeAreaView>
      </Modal>

      {/* Add Freezer Item Modal */}
      <Modal
        visible={showAddFreezerModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddFreezerModal(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add to Freezer</Text>
            <Pressable
              onPress={() => setShowAddFreezerModal(false)}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            <Text style={styles.formLabel}>Label</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. Bolognese Sauce"
              placeholderTextColor="#9CA3AF"
              value={freezerLabel}
              onChangeText={setFreezerLabel}
            />

            <Text style={styles.formLabel}>Type</Text>
            <View style={styles.typeRow}>
              {(['meal', 'ingredient'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setFreezerType(t)}
                  style={[
                    styles.typeChip,
                    freezerType === t && styles.typeChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      freezerType === t && styles.typeChipTextActive,
                    ]}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {freezerType === 'meal' ? (
              <>
                <Text style={styles.formLabel}>Portions</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 4"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={freezerPortions}
                  onChangeText={setFreezerPortions}
                />
              </>
            ) : (
              <>
                <Text style={styles.formLabel}>Quantity</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 500"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={freezerQuantity}
                  onChangeText={setFreezerQuantity}
                />
              </>
            )}

            <Text style={styles.formLabel}>Date Frozen</Text>
            <TextInput
              style={styles.formInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9CA3AF"
              value={freezerDate}
              onChangeText={setFreezerDate}
            />

            <Text style={styles.formLabel}>Use-by Date (optional)</Text>
            <TextInput
              style={styles.formInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9CA3AF"
              value={freezerUseBy}
              onChangeText={setFreezerUseBy}
            />

            <Pressable
              onPress={handleAddFreezerItem}
              style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
            >
              <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  cupboardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  suggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8A020',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  suggestBtnPressed: {
    opacity: 0.8,
  },
  suggestBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearBtnPressed: {
    opacity: 0.6,
  },
  clearBtnText: {
    fontSize: 13,
    color: '#C0392B',
    fontWeight: '600',
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
    paddingBottom: 32,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 10,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A2B4A',
  },
  lowStockLabel: {
    fontSize: 11,
    color: '#E8A020',
    fontWeight: '600',
    marginTop: 2,
  },
  quantityInput: {
    width: 52,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    color: '#1A2B4A',
    textAlign: 'center',
  },
  freezerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  freezerCount: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  addFreezerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2B4A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  addFreezerBtnPressed: {
    opacity: 0.8,
  },
  addFreezerBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  freezerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  freezerRowOld: {
    backgroundColor: '#FFFBF0',
  },
  freezerInfo: {
    flex: 1,
    gap: 4,
  },
  freezerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  freezerLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  typeBadge: {
    backgroundColor: '#EEF1F7',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  typeBadgeMeal: {
    backgroundColor: '#E0F2E9',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1A2B4A',
    textTransform: 'uppercase',
  },
  freezerMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  freezerUseBy: {
    fontSize: 12,
    color: '#6B7280',
  },
  oldWarning: {
    fontSize: 12,
    color: '#E8A020',
    fontWeight: '600',
  },
  removeBtn: {
    padding: 6,
  },
  removeBtnPressed: {
    opacity: 0.6,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 40,
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  // Modal
  modalSafe: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    opacity: 0.7,
  },
  closeBtnText: {
    fontSize: 16,
    color: '#1A2B4A',
    fontWeight: '700',
  },
  matchFilterRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9F9F7',
  },
  filterChipActive: {
    backgroundColor: '#1A2B4A',
    borderColor: '#1A2B4A',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  suggestionRowPressed: {
    backgroundColor: '#F9F9F7',
  },
  suggestionInfo: {
    flex: 1,
    gap: 6,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  suggestionMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  coverageBarBg: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  coverageBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  // Form
  formContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A2B4A',
    marginBottom: 4,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A2B4A',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9F9F7',
  },
  typeChipActive: {
    backgroundColor: '#1A2B4A',
    borderColor: '#1A2B4A',
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  typeChipTextActive: {
    color: '#FFFFFF',
  },
  saveBtn: {
    backgroundColor: '#1A2B4A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnPressed: {
    opacity: 0.8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
