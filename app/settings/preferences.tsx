import React, { useEffect, useState } from 'react';
import { View, Text, Switch, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';

const KEYS = {
  fussyEater: '@fussy_eater_mode',
  weekly: '@notif_weekly',
  freezer: '@notif_freezer',
  budget: '@notif_budget',
};

async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export default function PreferencesScreen() {
  const [fussyEater, setFussyEater] = useState(false);
  const [weeklyNotif, setWeeklyNotif] = useState(false);
  const [freezerNotif, setFreezerNotif] = useState(false);
  const [budgetNotif, setBudgetNotif] = useState(false);

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

  const handleWeeklyNotif = async (value: boolean) => {
    if (value) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert('Permission needed', 'Please allow notifications in your device settings.');
        return;
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Time to plan your meals! 🍽️',
          body: "You haven't set your meal plan for next week yet. Tap to start planning!",
        },
        trigger: { weekday: 1, hour: 19, minute: 0, repeats: true } as Notifications.WeeklyTriggerInput,
      });
    } else {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
    toggle(KEYS.weekly, value, setWeeklyNotif);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Preferences', headerStyle: { backgroundColor: '#FAFAF8' }, headerTitleStyle: { color: '#1A2B4A' } }} />
      <ScrollView style={styles.container}>
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
            description="Reminds you on Sunday evenings to plan next week's meals."
            value={weeklyNotif}
            onToggle={handleWeeklyNotif}
          />
          <Row
            label="Freezer Use-By Warning"
            description="Alerts you when freezer items are approaching 3 months old."
            value={freezerNotif}
            onToggle={(v) => toggle(KEYS.freezer, v, setFreezerNotif)}
          />
          <Row
            label="Budget Alert"
            description="Alerts you when your projected weekly spend is approaching your budget limit."
            value={budgetNotif}
            onToggle={(v) => toggle(KEYS.budget, v, setBudgetNotif)}
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
});
