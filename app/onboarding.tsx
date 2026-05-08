import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/stores/useAuthStore';
import { useBudgetStore } from '../src/stores/useBudgetStore';
import { upsertProfile } from '../src/services/supabaseService';

export const ONBOARDING_KEY = '@onboarding_complete';

const DIETARY_OPTIONS = [
  { key: 'vegetarian', label: 'Vegetarian', icon: '🥦' },
  { key: 'vegan', label: 'Vegan', icon: '🌱' },
  { key: 'glutenFree', label: 'Gluten-Free', icon: '🌾' },
  { key: 'dairyFree', label: 'Dairy-Free', icon: '🥛' },
  { key: 'kidFriendly', label: 'Kid-Friendly', icon: '👶' },
  { key: 'onePot', label: 'One-Pot Meals', icon: '🍲' },
] as const;

type DietaryKey = typeof DIETARY_OPTIONS[number]['key'];

const TOTAL_STEPS = 3;

export default function OnboardingScreen(): React.ReactElement {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setFamilySize = useAuthStore((s) => s.setFamilySize);
  const setWeeklyBudget = useBudgetStore((s) => s.setWeeklyBudget);

  const [step, setStep] = useState(1);
  const [familyName, setFamilyName] = useState(profile?.familyName ?? '');
  const [familySize, setLocalFamilySize] = useState(useAuthStore.getState().familySize);
  const [budget, setBudget] = useState('');
  const [selectedDietary, setSelectedDietary] = useState<Set<DietaryKey>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const adjustSize = (delta: number) => {
    setLocalFamilySize((s) => Math.max(1, Math.min(12, s + delta)));
  };

  const toggleDietary = useCallback((key: DietaryKey) => {
    setSelectedDietary((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      void handleFinish();
    }
  };

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      const name = familyName.trim() || 'My Family';
      const budgetNum = parseFloat(budget.replace('£', '').trim()) || 0;

      if (user?.id) {
        await upsertProfile({ userId: user.id, familyName: name, familySize });
      }
      setProfile({ userId: user?.id ?? '', familyName: name, familySize });
      setFamilySize(familySize);
      if (budgetNum > 0) setWeeklyBudget(budgetNum);

      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      // Update store synchronously BEFORE navigating so AuthGate's routing
      // effect sees onboardingComplete = true when segments change
      useAuthStore.getState().setOnboardingComplete(true);
      router.replace('/(tabs)');
    } catch {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      useAuthStore.getState().setOnboardingComplete(true);
      router.replace('/(tabs)');
    } finally {
      setIsSaving(false);
    }
  };

  const canAdvance =
    step === 1 ? familyName.trim().length > 0 :
    step === 2 ? true :
    true;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Progress bar */}
        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[styles.progressDot, i < step && styles.progressDotDone]}
            />
          ))}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={styles.emoji}>👋</Text>
              <Text style={styles.stepTitle}>Welcome to{'\n'}Family Dinner Planner</Text>
              <Text style={styles.stepSubtitle}>
                Let's get set up in 3 quick steps. First, tell us about your family.
              </Text>

              <Text style={styles.fieldLabel}>What's your family name?</Text>
              <TextInput
                style={styles.input}
                value={familyName}
                onChangeText={setFamilyName}
                placeholder="e.g. The Johnsons"
                placeholderTextColor="#9CA3AF"
                returnKeyType="done"
                autoFocus
              />

              <Text style={[styles.fieldLabel, { marginTop: 20 }]}>How many people are you cooking for?</Text>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => adjustSize(-1)}
                  style={[styles.stepBtn, familySize <= 1 && styles.stepBtnDisabled]}
                  disabled={familySize <= 1}
                >
                  <Ionicons name="remove" size={24} color={familySize <= 1 ? '#D1D5DB' : '#1A2B4A'} />
                </Pressable>
                <View style={styles.stepValueWrap}>
                  <Text style={styles.stepValue}>{familySize}</Text>
                  <Text style={styles.stepUnit}>{familySize === 1 ? 'person' : 'people'}</Text>
                </View>
                <Pressable
                  onPress={() => adjustSize(1)}
                  style={[styles.stepBtn, familySize >= 12 && styles.stepBtnDisabled]}
                  disabled={familySize >= 12}
                >
                  <Ionicons name="add" size={24} color={familySize >= 12 ? '#D1D5DB' : '#1A2B4A'} />
                </Pressable>
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.emoji}>💰</Text>
              <Text style={styles.stepTitle}>Set Your Weekly{'\n'}Food Budget</Text>
              <Text style={styles.stepSubtitle}>
                We'll track your meal plan spend against this. You can change it anytime.
              </Text>

              <Text style={styles.fieldLabel}>Weekly dinner budget</Text>
              <View style={styles.budgetInputRow}>
                <Text style={styles.budgetPrefix}>£</Text>
                <TextInput
                  style={styles.budgetInput}
                  value={budget}
                  onChangeText={setBudget}
                  placeholder="e.g. 60"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  autoFocus
                />
              </View>

              <View style={styles.budgetSuggestions}>
                {['40', '60', '80', '100'].map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => setBudget(v)}
                    style={[styles.suggestionChip, budget === v && styles.suggestionChipActive]}
                  >
                    <Text style={[styles.suggestionText, budget === v && styles.suggestionTextActive]}>
                      £{v}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.skipHint}>You can skip this and set it later in Budget settings.</Text>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.emoji}>🥗</Text>
              <Text style={styles.stepTitle}>Any Dietary{'\n'}Preferences?</Text>
              <Text style={styles.stepSubtitle}>
                We'll use these to highlight suitable recipes. Select all that apply.
              </Text>

              <View style={styles.dietaryGrid}>
                {DIETARY_OPTIONS.map(({ key, label, icon }) => {
                  const isSelected = selectedDietary.has(key);
                  return (
                    <Pressable
                      key={key}
                      onPress={() => toggleDietary(key)}
                      style={[styles.dietaryChip, isSelected && styles.dietaryChipActive]}
                    >
                      <Text style={styles.dietaryIcon}>{icon}</Text>
                      <Text style={[styles.dietaryLabel, isSelected && styles.dietaryLabelActive]}>
                        {label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={16} color="#8FAF7E" style={styles.dietaryCheck} />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.skipHint}>
                You can add allergens and family member details in Settings → Family Profiles.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step > 1 && (
            <Pressable
              onPress={() => setStep((s) => s - 1)}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="arrow-back" size={20} color="#6B7280" />
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleNext}
            disabled={!canAdvance || isSaving}
            style={({ pressed }) => [
              styles.nextBtn,
              !canAdvance && styles.nextBtnDisabled,
              pressed && canAdvance && { opacity: 0.88 },
              step === 1 && styles.nextBtnFull,
            ]}
          >
            <Text style={styles.nextBtnText}>
              {step === TOTAL_STEPS ? (isSaving ? 'Setting up…' : 'Let\'s Go!') : 'Continue'}
            </Text>
            {step < TOTAL_STEPS && (
              <Ionicons name="arrow-forward" size={18} color="#1A2B4A" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  flex: {
    flex: 1,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 20,
    paddingBottom: 8,
  },
  progressDot: {
    width: 32,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
  },
  progressDotDone: {
    backgroundColor: '#E8A020',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  stepContainer: {
    paddingTop: 24,
    gap: 6,
  },
  emoji: {
    fontSize: 52,
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1A2B4A',
    lineHeight: 38,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: '#1A2B4A',
    fontWeight: '600',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 8,
  },
  stepBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EEF1F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    backgroundColor: '#F9FAFB',
  },
  stepValueWrap: {
    alignItems: 'center',
    minWidth: 80,
  },
  stepValue: {
    fontSize: 40,
    fontWeight: '800',
    color: '#1A2B4A',
    lineHeight: 48,
  },
  stepUnit: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  budgetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  budgetPrefix: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  budgetInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  budgetSuggestions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  suggestionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  suggestionChipActive: {
    borderColor: '#E8A020',
    backgroundColor: '#FFF8EE',
  },
  suggestionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  suggestionTextActive: {
    color: '#E8A020',
  },
  skipHint: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 18,
    marginTop: 16,
    fontStyle: 'italic',
  },
  dietaryGrid: {
    gap: 10,
    marginTop: 4,
  },
  dietaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  dietaryChipActive: {
    borderColor: '#8FAF7E',
    backgroundColor: '#F0FBF0',
  },
  dietaryIcon: {
    fontSize: 24,
  },
  dietaryLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  dietaryLabelActive: {
    color: '#1A2B4A',
  },
  dietaryCheck: {
    marginLeft: 'auto',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FAFAF8',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E8A020',
    borderRadius: 14,
    paddingVertical: 16,
  },
  nextBtnFull: {
    flex: 1,
  },
  nextBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  nextBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A2B4A',
  },
});
