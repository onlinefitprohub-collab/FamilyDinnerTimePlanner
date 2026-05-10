import React, { useEffect, useState } from 'react';
import { View, Text, Switch, ScrollView, StyleSheet, Alert, Platform, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { useFreezerStore } from '../../src/stores/useFreezerStore';
import { useBudgetStore } from '../../src/stores/useBudgetStore';
import { useMealPlanStore } from '../../src/stores/useMealPlanStore';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { useRecipeLibrary } from '../../src/hooks/useRecipeLibrary';
import { Supermarket } from '../../src/types';
import { calculateRecipeCost } from '../../src/utils/pricing';
import { ingredients as allIngredients } from '../../src/data/ingredients';
import { AnyRecipe, WeeklyMealPlan } from '../../src/types';

const KEYS = {
  fussyEater: '@fussy_eater_mode',
  weekly: '@notif_weekly',
  freezer: '@notif_freezer',
  budget: '@notif_budget',
};

const DAYS: (keyof Omit<WeeklyMealPlan, 'id' | 'userId' | 'weekKey'>)[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

function getDaysInFreezer(frozenAt: string): number {
  return Math.floor((Date.now() - new Date(frozenAt).getTime()) / 86400000);
}

async function rescheduleAll(
  weekly: boolean,
  freezer: boolean,
  budget: boolean,
  allRecipes: AnyRecipe[],
) {
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (weekly) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time to plan your meals! 🍽️',
        body: "You haven't set your meal plan for next week yet. Tap to start planning!",
        data: { route: '/(tabs)/planner' },
      },
      trigger: { weekday: 1, hour: 19, minute: 0, repeats: true } as Notifications.WeeklyTriggerInput,
    });
  }

  if (freezer) {
    const freezerItems = useFreezerStore.getState().items;
    const approaching = freezerItems.filter((item) => getDaysInFreezer(item.frozenAt) >= 75);

    if (approaching.length > 0) {
      for (const item of approaching) {
        const days = getDaysInFreezer(item.frozenAt);
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '❄️ Freezer item nearing 3 months',
            body: `"${item.label}" has been frozen ${days} days — use it before it goes off!`,
            data: { route: '/pantry', params: { tab: 'freezer' } },
          },
          trigger: null,
        });
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '❄️ Weekly Freezer Check',
        body: 'Check your freezer for items approaching 3 months old.',
        data: { route: '/pantry', params: { tab: 'freezer' } },
      },
      trigger: { weekday: 4, hour: 9, minute: 0, repeats: true } as Notifications.WeeklyTriggerInput,
    });
  }

  if (budget) {
    const weeklyBudget = useBudgetStore.getState().weeklyBudget;
    const currentWeekKey = useMealPlanStore.getState().currentWeekKey;
    const plans = useMealPlanStore.getState().plans;
    const familySize = useAuthStore.getState().familySize;
    const plan = plans[currentWeekKey];

    if (plan && weeklyBudget > 0) {
      const totalSpend = DAYS.reduce((sum, day) => {
        const recipeId = plan[day];
        if (!recipeId) return sum;
        const recipe = allRecipes.find((r) => r.id === recipeId);
        if (!recipe) return sum;
        return sum + calculateRecipeCost(recipe, allIngredients, familySize);
      }, 0);

      const pct = totalSpend / weeklyBudget;
      if (pct >= 0.8) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '💰 Budget Alert',
            body: `You've used ${Math.round(pct * 100)}% of your £${weeklyBudget.toFixed(2)} weekly budget!`,
            data: { route: '/budget' },
          },
          trigger: null,
        });
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💰 Weekly Budget Summary',
        body: 'Check how your dinner spend compared to your budget this week.',
        data: { route: '/budget' },
      },
      trigger: { weekday: 1, hour: 18, minute: 0, repeats: true } as Notifications.WeeklyTriggerInput,
    });
  }
}

const SUPERMARKETS: Supermarket[] = ['Tesco', "Sainsbury's", 'Asda', 'Morrisons', 'Lidl', 'Aldi'];

export default function PreferencesScreen() {
  const [fussyEater, setFussyEater] = useState(false);
  const [weeklyNotif, setWeeklyNotif] = useState(false);
  const [freezerNotif, setFreezerNotif] = useState(false);
  const [budgetNotif, setBudgetNotif] = useState(false);

  const preferredSupermarket = useAuthStore((s) => s.preferredSupermarket);
  const setPreferredSupermarket = useAuthStore((s) => s.setPreferredSupermarket);

  const { recipes: allRecipes } = useRecipeLibrary();

  useEffect(() => {
    AsyncStorage.multiGet([KEYS.fussyEater, KEYS.weekly, KEYS.freezer, KEYS.budget]).then((pairs) => {
      setFussyEater(pairs[0][1] === 'true');
      setWeeklyNotif(pairs[1][1] === 'true');
      setFreezerNotif(pairs[2][1] === 'true');
      setBudgetNotif(pairs[3][1] === 'true');
    });
  }, []);

  const toggle = async (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    await AsyncStorage.setItem(key, String(value));
  };

  const handleNotifToggle = async (
    key: string,
    value: boolean,
    setter: (v: boolean) => void,
    weekly: boolean,
    freezer: boolean,
    budget: boolean,
  ) => {
    if (value) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert('Permission needed', 'Please allow notifications in your device settings.');
        return;
      }
    }
    setter(value);
    await AsyncStorage.setItem(key, String(value));
    await rescheduleAll(weekly, freezer, budget, allRecipes);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Preferences', headerStyle: { backgroundColor: '#FAFAF8' }, headerTitleStyle: { color: '#1A2B4A' } }} />
      <ScrollView style={styles.container}>
        <Section title="Single Store Mode">
          <View style={styles.supermarketRow}>
            <Text style={styles.supermarketLabel}>By default, your shopping list shows the cheapest store for each item. Select a store below to plan your entire shop at one place instead.</Text>
            <View style={styles.supermarketChips}>
              {SUPERMARKETS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setPreferredSupermarket(preferredSupermarket === s ? null : s)}
                  style={[styles.supermarketChip, preferredSupermarket === s && styles.supermarketChipActive]}
                >
                  <Text style={[styles.supermarketChipText, preferredSupermarket === s && styles.supermarketChipTextActive]}>{s}</Text>
                </Pressable>
              ))}
            </View>
            {!preferredSupermarket && (
              <Text style={styles.supermarketHint}>No store selected — showing cheapest price per item across all stores.</Text>
            )}
          </View>
        </Section>

        <Section title="Recipe Filtering">
          <Row
            label="Fussy Eater Mode"
            description="Automatically hides recipes containing any ingredient disliked by a family member."
            value={fussyEater}
            onToggle={(v) => toggle(KEYS.fussyEater, v, setFussyEater)}
          />
        </Section>

        <Section title="Notifications">
          <Row
            label="Weekly Plan Reminder"
            description="Reminds you on Monday evenings to plan next week's meals."
            value={weeklyNotif}
            onToggle={(v) =>
              handleNotifToggle(KEYS.weekly, v, setWeeklyNotif, v, freezerNotif, budgetNotif)
            }
          />
          <Row
            label="Freezer Use-By Warning"
            description="Alerts you when freezer items are approaching 3 months old, with a weekly Wednesday reminder."
            value={freezerNotif}
            onToggle={(v) =>
              handleNotifToggle(KEYS.freezer, v, setFreezerNotif, weeklyNotif, v, budgetNotif)
            }
          />
          <Row
            label="Budget Alert"
            description="Alerts you when your projected weekly spend is approaching or over your budget limit."
            value={budgetNotif}
            onToggle={(v) =>
              handleNotifToggle(KEYS.budget, v, setBudgetNotif, weeklyNotif, freezerNotif, v)
            }
          />
        </Section>
      </ScrollView>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({ label, description, value, onToggle }: {
  label: string; description: string; value: boolean; onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDesc}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onToggle} trackColor={{ true: '#E8A020' }} thumbColor="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowLeft: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#1A2B4A', marginBottom: 3 },
  rowDesc: { fontSize: 12, color: '#6B7280', lineHeight: 17 },
  supermarketRow: { padding: 16 },
  supermarketLabel: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 12 },
  supermarketChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  supermarketChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  supermarketChipActive: { backgroundColor: '#1A2B4A', borderColor: '#1A2B4A' },
  supermarketChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  supermarketChipTextActive: { color: '#FFFFFF' },
  supermarketHint: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
});
