import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  FlatList,
  Alert,
  Share,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useMealPlanStore } from '../../src/stores/useMealPlanStore';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { useBudgetStore } from '../../src/stores/useBudgetStore';
import { useTemplatesStore } from '../../src/stores/useTemplatesStore';
import { useFamilyStore } from '../../src/stores/useFamilyStore';
import { useRecipeLibrary } from '../../src/hooks/useRecipeLibrary';
import { calculateRecipeCost } from '../../src/utils/pricing';
import { calculateWeeklyNutrition } from '../../src/utils/nutrition';
import { checkAllergenConflicts } from '../../src/utils/allergens';
import FamilySizeSelector from '../../src/components/FamilySizeSelector';
import CostBadge from '../../src/components/CostBadge';
import { ingredients, getIngredientById } from '../../src/data/ingredients';
import { AnyRecipe, WeeklyMealPlan, MealPlanTemplate } from '../../src/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getWeekDates(weekKey: string): { day: string; date: Date }[] {
  // Parse "YYYY-WNN"
  const [yearStr, weekStr] = weekKey.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);

  // Find Monday of ISO week
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const monday = new Date(jan4.getTime() + (1 - jan4Day + (week - 1) * 7) * 86400000);

  const DAY_NAMES = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ] as const;

  return DAY_NAMES.map((day, i) => ({
    day,
    date: new Date(monday.getTime() + i * 86400000),
  }));
}

function formatWeekLabel(weekKey: string): string {
  const dates = getWeekDates(weekKey);
  const first = dates[0].date;
  const last = dates[6].date;
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const startStr = `${first.getUTCDate()} ${months[first.getUTCMonth()]}`;
  const endStr = `${last.getUTCDate()} ${months[last.getUTCMonth()]} ${last.getUTCFullYear()}`;
  return `${startStr} – ${endStr}`;
}

function navigateWeek(weekKey: string, direction: 1 | -1): string {
  const dates = getWeekDates(weekKey);
  const monday = dates[0].date;
  const next = new Date(monday.getTime() + direction * 7 * 86400000);
  return getISOWeekKey(next);
}

function formatDayLabel(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${days[date.getUTCDay()]} ${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
}

type MealDay = keyof Omit<WeeklyMealPlan, 'id' | 'userId' | 'weekKey'>;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PlannerScreen(): React.ReactElement {
  const [currentWeekKey, setCurrentWeekKey] = useState<string>(
    getISOWeekKey(new Date()),
  );
  const [showAddMealModal, setShowAddMealModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('monday');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [templateModalMode, setTemplateModalMode] = useState<'save' | 'load'>('load');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [showCheaperModal, setShowCheaperModal] = useState(false);
  const [cheaperSuggestions, setCheaperSuggestions] = useState<
    { day: MealDay; current: AnyRecipe; suggestion: AnyRecipe; saving: number }[]
  >([]);
  const [showBatchIngredients, setShowBatchIngredients] = useState(false);

  const plans = useMealPlanStore((s) => s.plans);
  const setMeal = useMealPlanStore((s) => s.setMeal);
  const removeMeal = useMealPlanStore((s) => s.removeMeal);

  const familySize = useAuthStore((s) => s.familySize);
  const user = useAuthStore((s) => s.user);
  const familyMembers = useFamilyStore((s) => s.members);

  const weeklyBudget = useBudgetStore((s) => s.weeklyBudget);

  const templates = useTemplatesStore((s) => s.templates);
  const saveTemplate = useTemplatesStore((s) => s.saveTemplate);
  const loadTemplate = useTemplatesStore((s) => s.loadTemplate);

  const { recipes: allRecipes } = useRecipeLibrary();

  const currentPlan = plans[currentWeekKey];
  const weekDates = getWeekDates(currentWeekKey);

  // Collect assigned recipes this week
  const weekRecipes = weekDates
    .map(({ day }) => {
      const recipeId = currentPlan?.[day as MealDay];
      if (!recipeId) return null;
      return allRecipes.find((r) => r.id === recipeId) ?? null;
    })
    .filter((r): r is AnyRecipe => r !== null);

  // Total cost this week
  const totalCost = weekRecipes.reduce(
    (sum, r) => sum + calculateRecipeCost(r, ingredients, familySize),
    0,
  );
  const costPerPerson = familySize > 0 ? totalCost / familySize : 0;
  const costPerDay = weekRecipes.length > 0 ? totalCost / weekRecipes.length : 0;
  const budgetPercent = weeklyBudget > 0 ? Math.min((totalCost / weeklyBudget) * 100, 100) : 0;

  const nutrition = calculateWeeklyNutrition(currentPlan, allRecipes, familySize);

  // Filtered recipes for add meal modal
  const filteredRecipes = allRecipes.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Batch cook: freezer-friendly recipes in this week's plan
  const batchCookRecipes = useMemo<AnyRecipe[]>(() => {
    return weekRecipes.filter((r) => r.freezerFriendly);
  }, [weekRecipes]);

  // Consolidated ingredient list for all batch cook recipes (×2 portions)
  const batchCookIngredients = useMemo<{ name: string; qty: number; unit: string }[]>(() => {
    const scale = (familySize / 4) * 2; // ×2 for batch
    const acc = new Map<string, { name: string; qty: number; unit: string }>();
    for (const recipe of batchCookRecipes) {
      for (const ri of recipe.ingredients) {
        const ingredient = getIngredientById(ri.ingredientId);
        const name = ingredient?.name ?? ri.ingredientId;
        const existing = acc.get(ri.ingredientId);
        if (existing) {
          existing.qty += ri.quantityPer4 * scale;
        } else {
          acc.set(ri.ingredientId, { name, qty: ri.quantityPer4 * scale, unit: ri.unit });
        }
      }
    }
    return Array.from(acc.values()).map((i) => ({ ...i, qty: Math.ceil(i.qty) }));
  }, [batchCookRecipes, familySize]);

  const handleOpenAddMeal = useCallback((day: string) => {
    setSelectedDay(day);
    setSearchQuery('');
    setShowAddMealModal(true);
  }, []);

  const handleSelectRecipe = useCallback(
    (recipe: AnyRecipe) => {
      setMeal(currentWeekKey, selectedDay as MealDay, recipe.id);
      setShowAddMealModal(false);
    },
    [currentWeekKey, selectedDay, setMeal],
  );

  const handleLongPressDay = useCallback(
    (day: string) => {
      Alert.alert(
        'Remove Meal',
        'Remove this meal from the plan?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => removeMeal(currentWeekKey, day),
          },
        ],
      );
    },
    [currentWeekKey, removeMeal],
  );

  const handleSuggestCheaperWeek = useCallback(() => {
    if (!currentPlan) {
      Alert.alert('No Plan', 'Add some meals to your plan first.');
      return;
    }
    const days: MealDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const suggestions: { day: MealDay; current: AnyRecipe; suggestion: AnyRecipe; saving: number }[] = [];

    for (const day of days) {
      const recipeId = currentPlan[day];
      if (!recipeId) continue;
      const current = allRecipes.find((r) => r.id === recipeId);
      if (!current) continue;
      const currentCost = calculateRecipeCost(current, ingredients, familySize);

      // Prefer same category, fall back to any recipe
      let bestRecipe: AnyRecipe | null = null;
      let bestCost = currentCost;

      for (const r of allRecipes) {
        if (r.id === recipeId) continue;
        if (r.category !== current.category) continue;
        const cost = calculateRecipeCost(r, ingredients, familySize);
        if (cost < bestCost) { bestCost = cost; bestRecipe = r; }
      }
      if (!bestRecipe) {
        for (const r of allRecipes) {
          if (r.id === recipeId) continue;
          const cost = calculateRecipeCost(r, ingredients, familySize);
          if (cost < bestCost) { bestCost = cost; bestRecipe = r; }
        }
      }

      if (bestRecipe) {
        suggestions.push({ day, current, suggestion: bestRecipe, saving: currentCost - bestCost });
      }
    }

    if (suggestions.length === 0) {
      Alert.alert('Already Optimal', "Your week's meals are already the cheapest options available!");
      return;
    }
    setCheaperSuggestions(suggestions);
    setShowCheaperModal(true);
  }, [currentPlan, allRecipes, familySize]);

  const handleApplyAllSuggestions = useCallback(() => {
    for (const s of cheaperSuggestions) {
      setMeal(currentWeekKey, s.day, s.suggestion.id);
    }
    const totalSaving = cheaperSuggestions.reduce((sum, s) => sum + s.saving, 0);
    setShowCheaperModal(false);
    Alert.alert('Applied!', `Cheaper week applied — saving £${totalSaving.toFixed(2)}.`);
  }, [cheaperSuggestions, currentWeekKey, setMeal]);

  const handleSaveTemplate = useCallback(() => {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to save templates.');
      return;
    }
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Save Template',
        'Enter a name for this week template:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: (name?: string) => {
              if (!name?.trim()) return;
              const days: MealPlanTemplate['days'] = {
                monday: currentPlan?.monday,
                tuesday: currentPlan?.tuesday,
                wednesday: currentPlan?.wednesday,
                thursday: currentPlan?.thursday,
                friday: currentPlan?.friday,
                saturday: currentPlan?.saturday,
                sunday: currentPlan?.sunday,
              };
              void saveTemplate(user.id, name.trim(), days);
            },
          },
        ],
        'plain-text',
      );
    } else {
      // Android / Web fallback
      Alert.alert(
        'Save Template',
        'This week will be saved as a template.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save as "My Template"',
            onPress: () => {
              const days: MealPlanTemplate['days'] = {
                monday: currentPlan?.monday,
                tuesday: currentPlan?.tuesday,
                wednesday: currentPlan?.wednesday,
                thursday: currentPlan?.thursday,
                friday: currentPlan?.friday,
                saturday: currentPlan?.saturday,
                sunday: currentPlan?.sunday,
              };
              void saveTemplate(user.id, `Template ${new Date().toLocaleDateString()}`, days);
            },
          },
        ],
      );
    }
  }, [currentPlan, saveTemplate, user]);

  const handleLoadTemplate = useCallback(() => {
    setTemplateModalMode('load');
    setShowTemplateModal(true);
  }, []);

  const handleApplyTemplate = useCallback(
    (templateId: string) => {
      const template = loadTemplate(templateId);
      if (!template) return;
      const days: MealDay[] = [
        'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
      ];
      for (const day of days) {
        const recipeId = template.days[day];
        if (recipeId) {
          setMeal(currentWeekKey, day, recipeId);
        }
      }
      setShowTemplateModal(false);
    },
    [currentWeekKey, loadTemplate, setMeal],
  );

  const handleCopyLastWeek = useCallback(() => {
    const lastWeekKey = navigateWeek(currentWeekKey, -1);
    const lastPlan = plans[lastWeekKey];
    if (!lastPlan) {
      Alert.alert('No Data', 'No meals found for last week.');
      return;
    }
    Alert.alert(
      'Copy Last Week',
      'Copy last week\'s meals to this week?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy',
          onPress: () => {
            const days: MealDay[] = [
              'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
            ];
            for (const day of days) {
              const recipeId = lastPlan[day];
              if (recipeId) {
                setMeal(currentWeekKey, day, recipeId);
              }
            }
          },
        },
      ],
    );
  }, [currentWeekKey, plans, setMeal]);

  const handleExportTemplate = useCallback(async () => {
    const days = {
      monday: currentPlan?.monday,
      tuesday: currentPlan?.tuesday,
      wednesday: currentPlan?.wednesday,
      thursday: currentPlan?.thursday,
      friday: currentPlan?.friday,
      saturday: currentPlan?.saturday,
      sunday: currentPlan?.sunday,
    };
    const exportData = { version: 1, name: `Week of ${formatWeekLabel(currentWeekKey)}`, days };
    const json = JSON.stringify(exportData, null, 2);
    try {
      await Share.share({ message: json, title: 'Meal Template' });
    } catch {
      Alert.alert('Export Template', json);
    }
  }, [currentPlan, currentWeekKey]);

  const handleImportTemplate = useCallback(() => {
    const json = importJson.trim();
    if (!json) return;
    try {
      const parsed = JSON.parse(json) as { version?: number; days?: Record<string, string | undefined> };
      const days = parsed.days ?? {};
      const dayKeys: MealDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      let imported = 0;
      for (const day of dayKeys) {
        const recipeId = days[day];
        if (recipeId) {
          setMeal(currentWeekKey, day, recipeId);
          imported++;
        }
      }
      setImportJson('');
      setShowImportModal(false);
      Alert.alert('Imported', `${imported} meal${imported !== 1 ? 's' : ''} applied to this week.`);
    } catch {
      Alert.alert('Invalid JSON', 'The pasted text is not a valid template. Please check and try again.');
    }
  }, [importJson, currentWeekKey, setMeal]);

  const getBudgetBarColor = (): string => {
    if (budgetPercent < 80) return '#8FAF7E';
    if (budgetPercent <= 100) return '#E8A020';
    return '#C0392B';
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => setCurrentWeekKey(navigateWeek(currentWeekKey, -1))}
            style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
            accessibilityLabel="Previous week"
          >
            <Text style={styles.navButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.weekLabel}>{formatWeekLabel(currentWeekKey)}</Text>
          <Pressable
            onPress={() => setCurrentWeekKey(navigateWeek(currentWeekKey, 1))}
            style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
            accessibilityLabel="Next week"
          >
            <Text style={styles.navButtonText}>›</Text>
          </Pressable>
        </View>

        {/* Family size */}
        <View style={styles.familySizeRow}>
          <Text style={styles.sectionLabel}>Family Size</Text>
          <FamilySizeSelector compact />
        </View>

        {/* Day cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daysScroll}
        >
          {weekDates.map(({ day, date }) => {
            const recipeId = currentPlan?.[day as MealDay];
            const recipe = recipeId
              ? allRecipes.find((r) => r.id === recipeId)
              : undefined;
            const cost = recipe
              ? calculateRecipeCost(recipe, ingredients, familySize)
              : 0;
            const costPerPerson2 = familySize > 0 ? cost / familySize : 0;
            const conflicts = recipe && familyMembers.length > 0
              ? checkAllergenConflicts(recipe, familyMembers)
              : [];
            const hasDanger = conflicts.some((c) => c.conflictType === 'allergen' && c.allergens.length > 0);

            return (
              <View key={day} style={styles.dayCard}>
                <Text style={styles.dayName}>{formatDayLabel(date)}</Text>
                {recipe ? (
                  <Pressable
                    onLongPress={() => handleLongPressDay(day)}
                    delayLongPress={500}
                    onPress={() => handleOpenAddMeal(day)}
                    style={({ pressed }) => [
                      styles.mealAssigned,
                      pressed && styles.mealAssignedPressed,
                    ]}
                    accessibilityLabel={`${recipe.name}. Long press to remove.`}
                  >
                    <Image
                      source={{ uri: recipe.image }}
                      style={styles.mealImage}
                      contentFit="cover"
                      transition={200}
                    />
                    <Text style={styles.mealName} numberOfLines={2}>
                      {recipe.name}
                    </Text>
                    <CostBadge costPerPerson={costPerPerson2} />
                    {conflicts.length > 0 && (
                      <View style={styles.conflictWarning}>
                        <Ionicons
                          name="warning"
                          size={11}
                          color={hasDanger ? '#C0392B' : '#E8A020'}
                        />
                        <Text style={[styles.conflictWarnText, { color: hasDanger ? '#C0392B' : '#E8A020' }]}>
                          {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => handleOpenAddMeal(day)}
                    style={({ pressed }) => [
                      styles.addMealButton,
                      pressed && styles.addMealButtonPressed,
                    ]}
                    accessibilityLabel={`Add meal for ${day}`}
                  >
                    <Text style={styles.addMealIcon}>+</Text>
                    <Text style={styles.addMealText}>Add meal</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Weekly summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Weekly Summary</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>£{totalCost.toFixed(2)}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>£{costPerPerson.toFixed(2)}</Text>
              <Text style={styles.summaryLabel}>Per person</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>£{costPerDay.toFixed(2)}</Text>
              <Text style={styles.summaryLabel}>Per day</Text>
            </View>
          </View>

          {/* Budget progress */}
          <Text style={styles.budgetLabel}>
            Budget: £{totalCost.toFixed(2)} / £{weeklyBudget.toFixed(2)}
          </Text>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${budgetPercent}%` as `${number}%`,
                  backgroundColor: getBudgetBarColor(),
                },
              ]}
            />
          </View>

          {/* Nutrition */}
          <View style={styles.nutritionRow}>
            <Text style={styles.nutritionText}>
              Avg daily calories: {nutrition.avgDailyCalories} kcal
            </Text>
          </View>
        </View>

        {/* Batch Cook Section */}
        {batchCookRecipes.length > 0 && (
          <View style={styles.batchCookCard}>
            <View style={styles.batchCookHeader}>
              <Text style={styles.batchCookTitle}>❄️ Cook Once, Eat Twice</Text>
              <Text style={styles.batchCookSub}>
                {batchCookRecipes.length} freezer-friendly meal{batchCookRecipes.length > 1 ? 's' : ''} this week
              </Text>
            </View>
            {batchCookRecipes.map((r) => {
              const singleCost = calculateRecipeCost(r, ingredients, familySize);
              const doubleCost = singleCost * 2;
              return (
                <View key={r.id} style={styles.batchCookRow}>
                  <View style={styles.batchCookInfo}>
                    <Text style={styles.batchCookName} numberOfLines={1}>{r.name}</Text>
                    {r.batchCookNotes && (
                      <Text style={styles.batchCookNotes} numberOfLines={2}>{r.batchCookNotes}</Text>
                    )}
                  </View>
                  <View style={styles.batchCookCosts}>
                    <Text style={styles.batchCookCostLabel}>×2 batch</Text>
                    <Text style={styles.batchCookCostValue}>£{doubleCost.toFixed(2)}</Text>
                  </View>
                </View>
              );
            })}
            <Pressable
              onPress={() => setShowBatchIngredients((v) => !v)}
              style={styles.batchIngrBtn}
            >
              <Ionicons
                name={showBatchIngredients ? 'chevron-up' : 'chevron-down'}
                size={14}
                color="#1A2B4A"
              />
              <Text style={styles.batchIngrBtnText}>
                {showBatchIngredients ? 'Hide' : 'Show'} batch cook ingredients ({batchCookIngredients.length})
              </Text>
            </Pressable>
            {showBatchIngredients && (
              <View style={styles.batchIngrList}>
                {batchCookIngredients.map((item) => (
                  <View key={item.name} style={styles.batchIngrRow}>
                    <Text style={styles.batchIngrName}>{item.name}</Text>
                    <Text style={styles.batchIngrQty}>{item.qty} {item.unit}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <Pressable
            onPress={handleSaveTemplate}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          >
            <Text style={styles.actionBtnText}>Save</Text>
          </Pressable>
          <Pressable
            onPress={handleLoadTemplate}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          >
            <Text style={styles.actionBtnText}>Load</Text>
          </Pressable>
          <Pressable
            onPress={() => void handleExportTemplate()}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          >
            <Text style={styles.actionBtnText}>Export</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowImportModal(true)}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          >
            <Text style={styles.actionBtnText}>Import</Text>
          </Pressable>
          <Pressable
            onPress={handleCopyLastWeek}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          >
            <Text style={styles.actionBtnText}>Copy Last Week</Text>
          </Pressable>
        </View>

        {/* Suggest Cheaper Week */}
        <Pressable
          onPress={handleSuggestCheaperWeek}
          style={({ pressed }) => [styles.suggestBtn, pressed && styles.suggestBtnPressed]}
        >
          <Ionicons name="trending-down-outline" size={18} color="#1A2B4A" />
          <Text style={styles.suggestBtnText}>Suggest a Cheaper Week</Text>
        </Pressable>
      </ScrollView>

      {/* Add Meal Modal */}
      <Modal
        visible={showAddMealModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowAddMealModal(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Meal</Text>
            <Pressable
              onPress={() => setShowAddMealModal(false)}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              accessibilityLabel="Close"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search recipes…"
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              returnKeyType="search"
            />
          </View>
          <FlatList
            data={filteredRecipes}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const cost = calculateRecipeCost(item, ingredients, familySize);
              const cpp = familySize > 0 ? cost / familySize : 0;
              const totalTime = item.prepTime + item.cookTime;
              return (
                <Pressable
                  onPress={() => handleSelectRecipe(item)}
                  style={({ pressed }) => [
                    styles.recipeRow,
                    pressed && styles.recipeRowPressed,
                  ]}
                  accessibilityLabel={item.name}
                >
                  <View style={styles.recipeRowInfo}>
                    <Text style={styles.recipeRowName}>{item.name}</Text>
                    <Text style={styles.recipeRowMeta}>
                      {totalTime} min · £{cpp.toFixed(2)} pp
                    </Text>
                  </View>
                  <CostBadge costPerPerson={cpp} />
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No recipes found.</Text>
            }
            contentContainerStyle={styles.recipeList}
          />
        </SafeAreaView>
      </Modal>

      {/* Import Template Modal */}
      <Modal
        visible={showImportModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowImportModal(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Import Template</Text>
            <Pressable
              onPress={() => setShowImportModal(false)}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.importScroll} contentContainerStyle={styles.importContent}>
            <Text style={styles.importHint}>
              Paste a previously exported template JSON below:
            </Text>
            <TextInput
              style={styles.importInput}
              multiline
              placeholder={'{\n  "version": 1,\n  "days": { ... }\n}'}
              placeholderTextColor="#9CA3AF"
              value={importJson}
              onChangeText={setImportJson}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
            <Pressable
              onPress={handleImportTemplate}
              style={({ pressed }) => [styles.importBtn, pressed && styles.importBtnPressed]}
            >
              <Text style={styles.importBtnText}>Apply Template</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Load Template Modal */}
      <Modal
        visible={showTemplateModal && templateModalMode === 'load'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTemplateModal(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Load Template</Text>
            <Pressable
              onPress={() => setShowTemplateModal(false)}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>
          <FlatList
            data={templates}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleApplyTemplate(item.id)}
                style={({ pressed }) => [
                  styles.recipeRow,
                  pressed && styles.recipeRowPressed,
                ]}
              >
                <View style={styles.recipeRowInfo}>
                  <Text style={styles.recipeRowName}>{item.name}</Text>
                  <Text style={styles.recipeRowMeta}>
                    Created {new Date(item.createdAt).toLocaleDateString()}
                    {item.lastUsedAt
                      ? ` · Last used ${new Date(item.lastUsedAt).toLocaleDateString()}`
                      : ''}
                  </Text>
                </View>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No templates saved yet.</Text>
            }
            contentContainerStyle={styles.recipeList}
          />
        </SafeAreaView>
      </Modal>

      {/* Suggest Cheaper Week Modal */}
      <Modal
        visible={showCheaperModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCheaperModal(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Cheaper Week Preview</Text>
            <Pressable
              onPress={() => setShowCheaperModal(false)}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.recipeList}>
            {cheaperSuggestions.length > 0 && (
              <View style={styles.cheaperSummaryBox}>
                <Text style={styles.cheaperSummaryText}>
                  Total saving: £{cheaperSuggestions.reduce((s, c) => s + c.saving, 0).toFixed(2)}
                </Text>
              </View>
            )}
            {cheaperSuggestions.map((s) => (
              <View key={s.day} style={styles.cheaperRow}>
                <View style={styles.cheaperDayLabel}>
                  <Text style={styles.cheaperDay}>{s.day.charAt(0).toUpperCase() + s.day.slice(1)}</Text>
                </View>
                <View style={styles.cheaperDetails}>
                  <View style={styles.cheaperSwapRow}>
                    <Text style={styles.cheaperFrom} numberOfLines={1}>{s.current.name}</Text>
                    <Ionicons name="arrow-forward" size={14} color="#6B7280" />
                    <Text style={styles.cheaperTo} numberOfLines={1}>{s.suggestion.name}</Text>
                  </View>
                  <Text style={styles.cheaperSaving}>Save £{s.saving.toFixed(2)}</Text>
                </View>
              </View>
            ))}
            <Pressable
              style={({ pressed }) => [styles.importBtn, pressed && styles.importBtnPressed]}
              onPress={handleApplyAllSuggestions}
            >
              <Text style={styles.importBtnText}>Apply All Suggestions</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A2B4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonPressed: {
    opacity: 0.7,
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
    textAlign: 'center',
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2B4A',
    flex: 1,
    textAlign: 'center',
  },
  familySizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2B4A',
  },
  daysScroll: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 10,
  },
  dayCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  dayName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A2B4A',
    marginBottom: 8,
  },
  mealAssigned: {
    alignItems: 'flex-start',
    gap: 6,
  },
  mealAssignedPressed: {
    opacity: 0.8,
  },
  mealImage: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  mealName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A2B4A',
    lineHeight: 16,
  },
  addMealButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 10,
    gap: 4,
  },
  addMealButtonPressed: {
    backgroundColor: '#F3F4F6',
  },
  addMealIcon: {
    fontSize: 28,
    color: '#E8A020',
    fontWeight: '700',
  },
  addMealText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2B4A',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A2B4A',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  budgetLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  nutritionRow: {
    marginTop: 10,
  },
  nutritionText: {
    fontSize: 12,
    color: '#6B7280',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#1A2B4A',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionBtnPressed: {
    opacity: 0.75,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  conflictWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  conflictWarnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  batchCookCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#EEF7EE',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#8FAF7E',
  },
  batchCookHeader: {
    gap: 2,
  },
  batchCookTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A2B4A',
  },
  batchCookSub: {
    fontSize: 12,
    color: '#6B7280',
  },
  batchCookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    gap: 10,
  },
  batchCookInfo: {
    flex: 1,
    gap: 2,
  },
  batchCookName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  batchCookNotes: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 15,
  },
  batchCookCosts: {
    alignItems: 'flex-end',
    gap: 2,
  },
  batchCookCostLabel: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  batchCookCostValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8FAF7E',
  },
  batchIngrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 8,
  },
  batchIngrBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A2B4A',
  },
  batchIngrList: {
    gap: 6,
    paddingTop: 4,
    paddingBottom: 4,
  },
  batchIngrRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  batchIngrName: {
    fontSize: 13,
    color: '#1A2B4A',
    flex: 1,
  },
  batchIngrQty: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  importScroll: {
    flex: 1,
  },
  importContent: {
    padding: 16,
    gap: 14,
  },
  importHint: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  importInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 14,
    fontSize: 13,
    color: '#1A2B4A',
    minHeight: 180,
    textAlignVertical: 'top',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  importBtn: {
    backgroundColor: '#1A2B4A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  importBtnPressed: {
    opacity: 0.8,
  },
  importBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
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
  searchRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1A2B4A',
  },
  recipeList: {
    paddingBottom: 32,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  recipeRowPressed: {
    backgroundColor: '#F9F9F7',
  },
  recipeRowInfo: {
    flex: 1,
  },
  recipeRowName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A2B4A',
  },
  recipeRowMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 32,
    paddingHorizontal: 32,
  },
  suggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 24,
    paddingVertical: 14,
    backgroundColor: '#EEF9EE',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#8FAF7E',
  },
  suggestBtnPressed: {
    opacity: 0.75,
  },
  suggestBtnText: {
    color: '#1A2B4A',
    fontWeight: '700',
    fontSize: 15,
  },
  cheaperSummaryBox: {
    backgroundColor: '#F0FFF0',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  cheaperSummaryText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#166534',
    textAlign: 'center',
  },
  cheaperRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  cheaperDayLabel: {
    width: 70,
    paddingTop: 2,
  },
  cheaperDay: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  cheaperDetails: {
    flex: 1,
    gap: 4,
  },
  cheaperSwapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  cheaperFrom: {
    fontSize: 13,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    flex: 1,
  },
  cheaperTo: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A2B4A',
    flex: 1,
  },
  cheaperSaving: {
    fontSize: 12,
    color: '#8FAF7E',
    fontWeight: '700',
  },
});
