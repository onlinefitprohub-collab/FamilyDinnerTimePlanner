import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMealPlanStore } from '../../src/stores/useMealPlanStore';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { useRecipeLibrary } from '../../src/hooks/useRecipeLibrary';
import { calculateWeeklyNutrition } from '../../src/utils/nutrition';
import { WeeklyMealPlan } from '../../src/types';

// ─── Helpers (mirrors planner.tsx) ───────────────────────────────────────────

function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getWeekDates(weekKey: string): Date[] {
  const [yearStr, weekStr] = weekKey.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const monday = new Date(jan4.getTime() + (1 - jan4Day + (week - 1) * 7) * 86400000);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86400000));
}

function formatWeekLabel(weekKey: string): string {
  const dates = getWeekDates(weekKey);
  const first = dates[0];
  const last = dates[6];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${first.getUTCDate()} ${months[first.getUTCMonth()]} – ${last.getUTCDate()} ${months[last.getUTCMonth()]} ${last.getUTCFullYear()}`;
}

function navigateWeek(weekKey: string, direction: 1 | -1): string {
  const monday = getWeekDates(weekKey)[0];
  return getISOWeekKey(new Date(monday.getTime() + direction * 7 * 86400000));
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const DAY_KEYS: Array<keyof Omit<WeeklyMealPlan, 'id' | 'userId' | 'weekKey'>> = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

// Recommended daily values (per person)
const DAILY_TARGETS = { calories: 2000, protein: 50, carbs: 260, fat: 70 };

// ─── Component ────────────────────────────────────────────────────────────────

export default function NutritionScreen(): React.ReactElement {
  const router = useRouter();
  const [weekKey, setWeekKey] = useState(() => getISOWeekKey(new Date()));

  const plans = useMealPlanStore((s) => s.plans);
  const familySize = useAuthStore((s) => s.familySize);
  const { recipes } = useRecipeLibrary();

  const plan = plans[weekKey];
  const nutrition = useMemo(
    () => calculateWeeklyNutrition(plan, recipes, familySize),
    [plan, recipes, familySize],
  );

  const perPerson = familySize > 0 ? familySize : 1;
  const daysWithData = nutrition.perDayCalories.filter((d) => d.calories > 0).length;
  const maxDayCals = Math.max(...nutrition.perDayCalories.map((d) => d.calories), 1);

  // Per-person weekly totals for macro bars
  const weeklyTargets = {
    calories: DAILY_TARGETS.calories * 7 * perPerson,
    protein: DAILY_TARGETS.protein * 7 * perPerson,
    carbs: DAILY_TARGETS.carbs * 7 * perPerson,
    fat: DAILY_TARGETS.fat * 7 * perPerson,
  };

  const macros = [
    { label: 'Calories', value: nutrition.totalCalories, target: weeklyTargets.calories, unit: 'kcal', color: '#E8A020' },
    { label: 'Protein', value: nutrition.totalProtein, target: weeklyTargets.protein, unit: 'g', color: '#1A2B4A' },
    { label: 'Carbs', value: nutrition.totalCarbs, target: weeklyTargets.carbs, unit: 'g', color: '#8FAF7E' },
    { label: 'Fat', value: nutrition.totalFat, target: weeklyTargets.fat, unit: 'g', color: '#C0392B' },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#1A2B4A" />
          </Pressable>
          <Text style={styles.screenTitle}>Nutrition</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Week navigation */}
          <View style={styles.weekNav}>
            <Pressable onPress={() => setWeekKey((k) => navigateWeek(k, -1))} style={styles.navBtn}>
              <Text style={styles.navBtnText}>‹</Text>
            </Pressable>
            <Text style={styles.weekLabel}>{formatWeekLabel(weekKey)}</Text>
            <Pressable onPress={() => setWeekKey((k) => navigateWeek(k, 1))} style={styles.navBtn}>
              <Text style={styles.navBtnText}>›</Text>
            </Pressable>
          </View>

          {daysWithData === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="nutrition-outline" size={52} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No data this week</Text>
              <Text style={styles.emptyBody}>
                Add meals to your planner. Nutrition data is shown for recipes that include macro information.
              </Text>
            </View>
          ) : (
            <>
              {/* Avg daily summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Avg daily calories ({daysWithData} meals planned)</Text>
                <Text style={styles.summaryCalories}>{nutrition.avgDailyCalories}</Text>
                <Text style={styles.summaryUnit}>kcal / day</Text>
                <Text style={styles.summaryPerPerson}>
                  ≈ {familySize > 0 ? Math.round(nutrition.avgDailyCalories / familySize) : 0} kcal per person
                </Text>
              </View>

              {/* Daily calorie bars */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Calories by Day</Text>
                <View style={styles.barChart}>
                  {DAY_KEYS.map((day, i) => {
                    const dayCals = nutrition.perDayCalories[i]?.calories ?? 0;
                    const pct = dayCals > 0 ? Math.max(4, (dayCals / maxDayCals) * 100) : 0;
                    return (
                      <View key={day} style={styles.barCol}>
                        {dayCals > 0 && (
                          <Text style={styles.barValue}>{dayCals}</Text>
                        )}
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              {
                                height: `${pct}%` as `${number}%`,
                                backgroundColor: dayCals > 0 ? '#E8A020' : 'transparent',
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.barLabel}>{DAY_LABELS[day]}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Macro progress bars */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Weekly Macros vs. Target</Text>
                <Text style={styles.cardSubtitle}>Based on {familySize} people × 7 days</Text>
                {macros.map((m) => {
                  const pct = m.target > 0 ? Math.min((m.value / m.target) * 100, 100) : 0;
                  const over = m.target > 0 && m.value > m.target;
                  return (
                    <View key={m.label} style={styles.macroRow}>
                      <View style={styles.macroLabelRow}>
                        <Text style={styles.macroLabel}>{m.label}</Text>
                        <Text style={styles.macroValue}>
                          {m.value.toLocaleString()} / {m.target.toLocaleString()} {m.unit}
                        </Text>
                      </View>
                      <View style={styles.macroTrack}>
                        <View
                          style={[
                            styles.macroFill,
                            {
                              width: `${pct}%` as `${number}%`,
                              backgroundColor: over ? '#C0392B' : m.color,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Per-day breakdown table */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Daily Breakdown</Text>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, styles.tableCellDay]}>Day</Text>
                  <Text style={styles.tableCell}>Kcal</Text>
                  <Text style={styles.tableCell}>Per person</Text>
                </View>
                {DAY_KEYS.map((day, i) => {
                  const cals = nutrition.perDayCalories[i]?.calories ?? 0;
                  return (
                    <View key={day} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                      <Text style={[styles.tableCell, styles.tableCellDay]}>{DAY_LABELS[day]}</Text>
                      <Text style={styles.tableCell}>{cals > 0 ? cals.toLocaleString() : '—'}</Text>
                      <Text style={styles.tableCell}>
                        {cals > 0 && familySize > 0
                          ? Math.round(cals / familySize).toLocaleString()
                          : '—'}
                      </Text>
                    </View>
                  );
                })}
                <View style={[styles.tableRow, styles.tableTotalRow]}>
                  <Text style={[styles.tableCell, styles.tableCellDay, styles.tableTotalText]}>Total</Text>
                  <Text style={[styles.tableCell, styles.tableTotalText]}>
                    {nutrition.totalCalories.toLocaleString()}
                  </Text>
                  <Text style={[styles.tableCell, styles.tableTotalText]}>
                    {familySize > 0 ? Math.round(nutrition.totalCalories / familySize).toLocaleString() : '—'}
                  </Text>
                </View>
              </View>

              <Text style={styles.disclaimer}>
                Nutrition data is only available for recipes with macro information. Recipes without data show 0 kcal.
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAF8' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 4 : 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 38, height: 38, justifyContent: 'center' },
  screenTitle: { fontSize: 17, fontWeight: '700', color: '#1A2B4A' },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  navBtn: { padding: 8 },
  navBtnText: { fontSize: 22, color: '#1A2B4A', fontWeight: '600' },
  weekLabel: { fontSize: 13, fontWeight: '600', color: '#1A2B4A', textAlign: 'center', flex: 1 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A2B4A' },
  emptyBody: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21, paddingHorizontal: 20 },
  summaryCard: {
    backgroundColor: '#1A2B4A',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    gap: 4,
  },
  summaryLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryCalories: { fontSize: 52, fontWeight: '800', color: '#E8A020', lineHeight: 60 },
  summaryUnit: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  summaryPerPerson: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1A2B4A' },
  cardSubtitle: { fontSize: 12, color: '#9CA3AF', marginTop: -8 },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 6 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barValue: { fontSize: 9, color: '#6B7280', textAlign: 'center' },
  barTrack: { flex: 1, width: '100%', backgroundColor: '#F3F4F6', borderRadius: 4, justifyContent: 'flex-end' },
  barFill: { borderRadius: 4, width: '100%' },
  barLabel: { fontSize: 10, color: '#6B7280', fontWeight: '600' },
  macroRow: { gap: 6 },
  macroLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  macroLabel: { fontSize: 13, fontWeight: '600', color: '#1A2B4A' },
  macroValue: { fontSize: 12, color: '#6B7280' },
  macroTrack: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  macroFill: { height: '100%', borderRadius: 4 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: '#E5E7EB', paddingBottom: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 8 },
  tableRowAlt: { backgroundColor: '#FAFAF8' },
  tableTotalRow: { borderTopWidth: 1.5, borderTopColor: '#E5E7EB', marginTop: 4 },
  tableCell: { flex: 1, fontSize: 13, color: '#374151', textAlign: 'center' },
  tableCellDay: { textAlign: 'left', fontWeight: '600', color: '#1A2B4A' },
  tableTotalText: { fontWeight: '700', color: '#1A2B4A' },
  disclaimer: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 16 },
});
