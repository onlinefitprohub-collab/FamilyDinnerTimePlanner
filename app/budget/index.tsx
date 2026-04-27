import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
  SafeAreaView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BarChart } from 'react-native-gifted-charts';
import { useBudgetStore } from '../../src/stores/useBudgetStore';
import { useMealPlanStore } from '../../src/stores/useMealPlanStore';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { useRecipeLibrary } from '../../src/hooks/useRecipeLibrary';
import { calculateRecipeCost } from '../../src/utils/pricing';
import { ingredients as allIngredients } from '../../src/data/ingredients';
import { AnyRecipe, WeeklyMealPlan, Supermarket } from '../../src/types';
import BarcodeScanModal from '../../src/components/BarcodeScanModal';
import { BarcodeResult } from '../../src/services/openFoodFacts';
import { supabase } from '../../src/lib/supabase';

const SUPERMARKETS: Supermarket[] = ['Tesco', "Sainsbury's", 'Asda', 'Morrisons', 'Lidl', 'Aldi'];
const SUPERMARKET_COLORS: Record<Supermarket, string> = {
  Tesco: '#005EB8',
  "Sainsbury's": '#F06C00',
  Asda: '#78BE20',
  Morrisons: '#FFD700',
  Lidl: '#0050AA',
  Aldi: '#00539B',
};

function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function navigateWeek(weekKey: string, direction: number): string {
  const [yearStr, weekStr] = weekKey.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const monday = new Date(jan4.getTime() + (1 - jan4Day + (week - 1) * 7) * 86400000);
  const next = new Date(monday.getTime() + direction * 7 * 86400000);
  return getISOWeekKey(next);
}

function getWeekRecipes(
  plan: WeeklyMealPlan | undefined,
  allRecipes: AnyRecipe[],
): AnyRecipe[] {
  if (!plan) return [];
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  return days
    .map((d) => {
      const id = plan[d];
      if (!id) return null;
      return allRecipes.find((r) => r.id === id) ?? null;
    })
    .filter((r): r is AnyRecipe => r !== null);
}

export default function BudgetScreen(): React.ReactElement {
  const weeklyBudget = useBudgetStore((s) => s.weeklyBudget);
  const setWeeklyBudget = useBudgetStore((s) => s.setWeeklyBudget);

  const plans = useMealPlanStore((s) => s.plans);
  const currentWeekKey = useMealPlanStore((s) => s.currentWeekKey);
  const setMeal = useMealPlanStore((s) => s.setMeal);

  const familySize = useAuthStore((s) => s.familySize);

  const { recipes: allRecipes } = useRecipeLibrary();

  const [budgetInput, setBudgetInput] = useState(weeklyBudget.toFixed(2));
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanResult, setScanResult] = useState<BarcodeResult | null>(null);
  const [pricePaid, setPricePaid] = useState('');
  const [selectedSupermarket, setSelectedSupermarket] = useState<Supermarket>('Tesco');

  const currentPlan = plans[currentWeekKey];

  const weekRecipes = useMemo(
    () => getWeekRecipes(currentPlan, allRecipes),
    [currentPlan, allRecipes],
  );

  const totalSpend = useMemo(
    () => weekRecipes.reduce(
      (sum, r) => sum + calculateRecipeCost(r, allIngredients, familySize),
      0,
    ),
    [weekRecipes, familySize],
  );

  const budgetPercent = weeklyBudget > 0 ? (totalSpend / weeklyBudget) * 100 : 0;

  const getBudgetBarColor = (): string => {
    if (budgetPercent < 80) return '#8FAF7E';
    if (budgetPercent <= 100) return '#E8A020';
    return '#C0392B';
  };

  // Cheapest / most expensive this week
  const recipeWithCosts = useMemo(
    () =>
      weekRecipes.map((r) => ({
        recipe: r,
        cost: calculateRecipeCost(r, allIngredients, familySize),
        costPerPerson: calculateRecipeCost(r, allIngredients, familySize) / Math.max(familySize, 1),
      })),
    [weekRecipes, familySize],
  );

  const cheapest = recipeWithCosts.length > 0
    ? recipeWithCosts.reduce((a, b) => (a.costPerPerson < b.costPerPerson ? a : b))
    : null;
  const mostExpensive = recipeWithCosts.length > 0
    ? recipeWithCosts.reduce((a, b) => (a.costPerPerson > b.costPerPerson ? a : b))
    : null;

  const handleScanResult = useCallback((result: BarcodeResult) => {
    setScanResult(result);
    setPricePaid('');
  }, []);

  const handleLogPrice = useCallback(async () => {
    if (!scanResult) return;
    const price = parseFloat(pricePaid);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid price', 'Enter a valid price greater than 0.');
      return;
    }
    const ingredientId = scanResult.matchedIngredientId ?? `custom-${scanResult.barcode}`;
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      if (userId) {
        await supabase.from('price_logs').insert({
          user_id: userId,
          ingredient_id: ingredientId,
          supermarket: selectedSupermarket,
          price_paid: price,
          logged_at: new Date().toISOString(),
        });
      }
      Alert.alert('Logged!', `£${price.toFixed(2)} at ${selectedSupermarket} saved.`);
      setScanResult(null);
    } catch {
      Alert.alert('Error', 'Could not log price. Please try again.');
    }
  }, [scanResult, pricePaid, selectedSupermarket]);

  const handleSaveBudget = (): void => {
    const parsed = parseFloat(budgetInput.replace('£', '').trim());
    if (isNaN(parsed) || parsed < 0) {
      Alert.alert('Invalid amount', 'Please enter a valid budget amount.');
      return;
    }
    void setWeeklyBudget(parsed);
  };

  const handleSuggestCheaperWeek = (): void => {
    Alert.alert(
      'Suggest a Cheaper Week',
      'This will replace your current meal plan with the 7 cheapest recipes. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, fill it in',
          onPress: () => {
            const sorted = [...allRecipes]
              .map((r) => ({
                recipe: r,
                costPerPerson: calculateRecipeCost(r, allIngredients, familySize) / Math.max(familySize, 1),
              }))
              .sort((a, b) => a.costPerPerson - b.costPerPerson)
              .slice(0, 7);

            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
            sorted.forEach((item, index) => {
              const day = days[index];
              if (day) {
                setMeal(currentWeekKey, day, item.recipe.id);
              }
            });
          },
        },
      ],
    );
  };

  // Monthly bar chart: 4 weeks of projected spend
  const barData = useMemo(() => {
    return [-3, -2, -1, 0].map((offset) => {
      const weekKey = navigateWeek(currentWeekKey, offset);
      const plan = plans[weekKey];
      const recipes = getWeekRecipes(plan, allRecipes);
      const spend = recipes.reduce(
        (sum, r) => sum + calculateRecipeCost(r, allIngredients, familySize),
        0,
      );
      const weekNum = weekKey.split('-W')[1] ?? '';
      return {
        value: parseFloat(spend.toFixed(2)),
        label: `W${weekNum}`,
        frontColor: offset === 0 ? '#E8A020' : '#1A2B4A',
      };
    });
  }, [currentWeekKey, plans, allRecipes, familySize]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Budget</Text>

        {/* Budget input */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly Dinner Budget</Text>
          <View style={styles.budgetRow}>
            <Text style={styles.poundSign}>£</Text>
            <TextInput
              style={styles.budgetInput}
              value={budgetInput}
              onChangeText={setBudgetInput}
              keyboardType="decimal-pad"
              placeholder="60.00"
              placeholderTextColor="#9CA3AF"
              selectTextOnFocus
            />
            <Pressable
              onPress={handleSaveBudget}
              style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
            >
              <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>
          </View>
        </View>

        {/* Budget progress */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>This Week</Text>
          <View style={styles.spendRow}>
            <Text style={styles.spendAmount}>£{totalSpend.toFixed(2)}</Text>
            <Text style={styles.spendOf}> / £{weeklyBudget.toFixed(2)}</Text>
          </View>
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(budgetPercent, 100)}%` as `${number}%`,
                  backgroundColor: getBudgetBarColor(),
                },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {budgetPercent.toFixed(0)}% of budget used
          </Text>

          {/* Budget alert */}
          {weeklyBudget > 0 && budgetPercent > 80 && (
            <View style={[
              styles.alertBanner,
              budgetPercent > 100 ? styles.alertDanger : styles.alertWarning,
            ]}>
              <Ionicons
                name={budgetPercent > 100 ? 'alert-circle' : 'warning-outline'}
                size={16}
                color={budgetPercent > 100 ? '#C0392B' : '#92400E'}
              />
              <Text style={[
                styles.alertText,
                budgetPercent > 100 ? styles.alertTextDanger : styles.alertTextWarning,
              ]}>
                {budgetPercent > 100
                  ? `£${(totalSpend - weeklyBudget).toFixed(2)} over budget this week`
                  : `Getting close — £${(weeklyBudget - totalSpend).toFixed(2)} remaining`}
              </Text>
            </View>
          )}
        </View>

        {/* Per-recipe breakdown */}
        {recipeWithCosts.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Meal Breakdown</Text>
            {recipeWithCosts.map(({ recipe, cost, costPerPerson }) => (
              <View key={recipe.id} style={styles.mealBreakdownRow}>
                <View style={styles.mealNameRow}>
                  <Text style={styles.mealBreakdownName} numberOfLines={1}>{recipe.name}</Text>
                  <View style={styles.mealBreakdownCosts}>
                    <Text style={styles.mealBreakdownTotal}>£{cost.toFixed(2)}</Text>
                    <Text style={styles.mealBreakdownPp}>£{costPerPerson.toFixed(2)}pp</Text>
                  </View>
                </View>
                <View style={styles.mealBarTrack}>
                  <View
                    style={[
                      styles.mealBarFill,
                      {
                        width: `${totalSpend > 0 ? (cost / totalSpend) * 100 : 0}%` as `${number}%`,
                        backgroundColor: cost === (cheapest?.cost ?? -1) && recipeWithCosts.length > 1
                          ? '#8FAF7E'
                          : cost === (mostExpensive?.cost ?? -1) && recipeWithCosts.length > 1
                          ? '#C0392B'
                          : '#4A90D9',
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
            <View style={styles.mealBreakdownFooter}>
              <Text style={styles.mealBreakdownFooterLabel}>Total</Text>
              <Text style={styles.mealBreakdownFooterValue}>£{totalSpend.toFixed(2)}</Text>
            </View>
          </View>
        )}

        {/* Insights */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Insights</Text>
          <Text style={styles.insightText}>
            This week you're projected to spend{' '}
            <Text style={styles.insightBold}>£{totalSpend.toFixed(2)}</Text> for your family of{' '}
            <Text style={styles.insightBold}>{familySize}</Text>.
          </Text>

          {cheapest && (
            <View style={styles.insightChip}>
              <Text style={styles.insightChipLabel}>Cheapest meal</Text>
              <Text style={styles.insightChipValue}>
                {cheapest.recipe.name} — £{cheapest.costPerPerson.toFixed(2)} pp
              </Text>
            </View>
          )}

          {mostExpensive && cheapest?.recipe.id !== mostExpensive.recipe.id && (
            <View style={[styles.insightChip, styles.insightChipDanger]}>
              <Text style={styles.insightChipLabel}>Most expensive</Text>
              <Text style={styles.insightChipValue}>
                {mostExpensive.recipe.name} — £{mostExpensive.costPerPerson.toFixed(2)} pp
              </Text>
            </View>
          )}
        </View>

        {/* Scan & Compare */}
        <Pressable
          onPress={() => setShowScanModal(true)}
          style={({ pressed }) => [styles.scanCompareBtn, pressed && styles.scanCompareBtnPressed]}
        >
          <Ionicons name="barcode-outline" size={18} color="#1A2B4A" />
          <Text style={styles.scanCompareBtnText}>Scan & Compare Prices</Text>
        </Pressable>

        {/* Suggest cheaper week */}
        <Pressable
          onPress={handleSuggestCheaperWeek}
          style={({ pressed }) => [
            styles.suggestBtn,
            pressed && styles.suggestBtnPressed,
          ]}
        >
          <Text style={styles.suggestBtnText}>Suggest a Cheaper Week</Text>
        </Pressable>

        {/* Monthly bar chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Last 4 Weeks</Text>
          <BarChart
            data={barData}
            barWidth={44}
            spacing={16}
            roundedTop
            xAxisThickness={1}
            yAxisThickness={0}
            yAxisTextStyle={styles.chartAxisText}
            xAxisLabelTextStyle={styles.chartAxisText}
            noOfSections={4}
            maxValue={Math.max(weeklyBudget * 1.5, 100)}
            referenceLine1Config={{
              color: '#C0392B',
              dashWidth: 4,
              dashGap: 4,
              thickness: 1.5,
            }}
            referenceLine1Position={weeklyBudget}
            showReferenceLine1
            isAnimated
          />
          <Text style={styles.chartNote}>
            Red line = weekly budget (£{weeklyBudget.toFixed(2)})
          </Text>
        </View>
      </ScrollView>

      <BarcodeScanModal
        visible={showScanModal}
        action="budget"
        onClose={() => setShowScanModal(false)}
        onResult={handleScanResult}
      />

      {/* Price log modal */}
      <Modal visible={!!scanResult} animationType="slide" transparent>
        <View style={styles.priceModalOverlay}>
          <View style={styles.priceModalCard}>
            <Text style={styles.priceModalTitle}>Log Price</Text>
            {scanResult && (
              <>
                <Text style={styles.priceModalProduct}>{scanResult.productName}</Text>
                {scanResult.matchedIngredientName && (
                  <Text style={styles.priceModalMatch}>
                    Matched: {scanResult.matchedIngredientName}
                  </Text>
                )}

                {/* Supermarket selector */}
                <Text style={styles.priceModalLabel}>Where did you buy it?</Text>
                <View style={styles.supermarketChips}>
                  {SUPERMARKETS.map((sm) => (
                    <Pressable
                      key={sm}
                      onPress={() => setSelectedSupermarket(sm)}
                      style={[
                        styles.smChip,
                        selectedSupermarket === sm && { backgroundColor: SUPERMARKET_COLORS[sm] },
                      ]}
                    >
                      <Text style={[
                        styles.smChipText,
                        selectedSupermarket === sm && styles.smChipTextActive,
                      ]}>
                        {sm}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Price paid input */}
                <Text style={styles.priceModalLabel}>How much did you pay?</Text>
                <View style={styles.priceInputRow}>
                  <Text style={styles.priceModalPound}>£</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={pricePaid}
                    onChangeText={setPricePaid}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    selectTextOnFocus
                  />
                </View>

                {/* Comparison against data prices */}
                {scanResult.matchedIngredientId && (() => {
                  const ing = allIngredients.find((i) => i.id === scanResult.matchedIngredientId);
                  if (!ing) return null;
                  return (
                    <View style={styles.comparisonTable}>
                      <Text style={styles.comparisonTitle}>Current prices in our database:</Text>
                      {ing.prices.map((p) => (
                        <View key={p.supermarket} style={styles.comparisonRow}>
                          <Text style={styles.comparisonSm}>{p.supermarket}</Text>
                          <Text style={styles.comparisonPrice}>£{p.pricePerUnit.toFixed(2)}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })()}

                <Pressable style={styles.logBtn} onPress={() => void handleLogPrice()}>
                  <Text style={styles.logBtnText}>Log This Price</Text>
                </Pressable>
                <Pressable style={styles.priceModalCancel} onPress={() => setScanResult(null)}>
                  <Text style={styles.priceModalCancelText}>Cancel</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A2B4A',
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    gap: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  poundSign: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  budgetInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#1A2B4A',
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 4,
  },
  saveBtn: {
    backgroundColor: '#1A2B4A',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveBtnPressed: {
    opacity: 0.75,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  spendRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  spendAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A2B4A',
  },
  spendOf: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  progressBg: {
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 10,
  },
  alertWarning: {
    backgroundColor: '#FEF3C7',
  },
  alertDanger: {
    backgroundColor: '#FEE2E2',
  },
  alertText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  alertTextWarning: {
    color: '#92400E',
  },
  alertTextDanger: {
    color: '#C0392B',
  },
  mealBreakdownRow: {
    gap: 4,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  mealNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mealBarTrack: {
    height: 3,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  mealBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  mealBreakdownName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A2B4A',
    flex: 1,
    flexShrink: 1,
  },
  mealBreakdownCosts: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  mealBreakdownTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  mealBreakdownPp: {
    fontSize: 11,
    color: '#9CA3AF',
    minWidth: 54,
    textAlign: 'right',
  },
  mealBreakdownFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    marginTop: 2,
  },
  mealBreakdownFooterLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  mealBreakdownFooterValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A2B4A',
  },
  insightText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  insightBold: {
    fontWeight: '700',
    color: '#1A2B4A',
  },
  insightChip: {
    backgroundColor: '#F0F9F0',
    borderRadius: 10,
    padding: 10,
    gap: 3,
  },
  insightChipDanger: {
    backgroundColor: '#FEF2F2',
  },
  insightChipLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  insightChipValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2B4A',
  },
  suggestBtn: {
    backgroundColor: '#E8A020',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  suggestBtnPressed: {
    opacity: 0.8,
  },
  suggestBtnText: {
    color: '#1A2B4A',
    fontWeight: '800',
    fontSize: 15,
  },
  chartAxisText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  chartNote: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  scanCompareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#EEF1F7', borderRadius: 12,
    paddingVertical: 14, marginBottom: 12,
  },
  scanCompareBtnPressed: { opacity: 0.7 },
  scanCompareBtnText: { color: '#1A2B4A', fontWeight: '700', fontSize: 15 },
  priceModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  priceModalCard: {
    backgroundColor: '#FAFAF8', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 48, gap: 12,
  },
  priceModalTitle: { fontSize: 20, fontWeight: '800', color: '#1A2B4A' },
  priceModalProduct: { fontSize: 16, fontWeight: '600', color: '#374151' },
  priceModalMatch: { fontSize: 13, color: '#8FAF7E', fontWeight: '600' },
  priceModalLabel: {
    fontSize: 12, fontWeight: '700', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 4,
  },
  supermarketChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  smChipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  smChipTextActive: { color: '#fff' },
  priceInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 10, overflow: 'hidden',
  },
  priceModalPound: {
    paddingHorizontal: 12, fontSize: 18, fontWeight: '700', color: '#1A2B4A',
  },
  priceInput: {
    flex: 1, paddingVertical: 12, paddingRight: 14,
    fontSize: 18, color: '#1A2B4A', fontWeight: '700',
  },
  comparisonTable: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, gap: 6 },
  comparisonTitle: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 4 },
  comparisonRow: { flexDirection: 'row', justifyContent: 'space-between' },
  comparisonSm: { fontSize: 13, color: '#374151' },
  comparisonPrice: { fontSize: 13, fontWeight: '700', color: '#1A2B4A' },
  logBtn: {
    backgroundColor: '#E8A020', borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  logBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  priceModalCancel: { paddingVertical: 10, alignItems: 'center' },
  priceModalCancelText: { color: '#6B7280', fontWeight: '600' },
});
