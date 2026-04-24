import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwakeAsync } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { useRecipeLibrary } from '../../../src/hooks/useRecipeLibrary';

export default function CookingModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getRecipeById } = useRecipeLibrary();
  const [currentStep, setCurrentStep] = useState(0);

  const recipe = getRecipeById(id ?? '');

  useEffect(() => {
    activateKeepAwakeAsync();
    return () => { deactivateKeepAwakeAsync(); };
  }, []);

  if (!recipe || recipe.steps.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Recipe not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const steps = recipe.steps;
  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isLast) { router.back(); return; }
    setCurrentStep((s) => s + 1);
  };

  const handlePrev = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isFirst) setCurrentStep((s) => s - 1);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.progressText}>Step {currentStep + 1} of {steps.length}</Text>
        </View>

        {/* Progress dots */}
        <View style={styles.dotsRow}>
          {steps.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentStep && styles.dotActive]} />
          ))}
        </View>

        {/* Step content */}
        <View style={styles.stepContent}>
          <View style={styles.stepNumberCircle}>
            <Text style={styles.stepNumberText}>{step.stepNumber}</Text>
          </View>

          <Text style={styles.instruction}>{step.instruction}</Text>

          {step.duration && (
            <View style={styles.durationBadge}>
              <Ionicons name="time-outline" size={16} color="#E8A020" />
              <Text style={styles.durationText}>{step.duration} mins</Text>
            </View>
          )}

          {step.tip && (
            <View style={styles.tipBox}>
              <Text style={styles.tipTitle}>💡 Tip</Text>
              <Text style={styles.tipText}>{step.tip}</Text>
            </View>
          )}
        </View>

        {/* Navigation buttons */}
        <View style={styles.navRow}>
          <Pressable
            onPress={handlePrev}
            style={[styles.navBtn, styles.prevBtn, isFirst && styles.navBtnDisabled]}
            disabled={isFirst}
          >
            <Ionicons name="arrow-back" size={20} color={isFirst ? '#666' : '#fff'} />
            <Text style={[styles.navBtnText, isFirst && styles.navBtnTextDisabled]}>Previous</Text>
          </Pressable>

          <Pressable onPress={handleNext} style={[styles.navBtn, isLast ? styles.finishBtn : styles.nextBtn]}>
            <Text style={styles.navBtnText}>{isLast ? '✓ Finish' : 'Next'}</Text>
            {!isLast && <Ionicons name="arrow-forward" size={20} color="#fff" />}
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A2B4A' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingHorizontal: 20, paddingBottom: 12 },
  closeBtn: { padding: 8 },
  progressText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: '#E8A020', width: 24 },
  stepContent: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  stepNumberCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E8A020', justifyContent: 'center', alignItems: 'center', marginBottom: 24, alignSelf: 'center' },
  stepNumberText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  instruction: { fontSize: 22, color: '#fff', lineHeight: 34, textAlign: 'center', marginBottom: 24 },
  durationBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'center', marginBottom: 16 },
  durationText: { color: '#E8A020', fontSize: 14, fontWeight: '600' },
  tipBox: { backgroundColor: 'rgba(232,160,32,0.15)', borderLeftWidth: 3, borderLeftColor: '#E8A020', borderRadius: 8, padding: 14, marginTop: 8 },
  tipTitle: { color: '#E8A020', fontWeight: '700', marginBottom: 4 },
  tipText: { color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 22 },
  navRow: { flexDirection: 'row', gap: 12, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  navBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 12 },
  prevBtn: { backgroundColor: 'rgba(255,255,255,0.15)' },
  nextBtn: { backgroundColor: '#E8A020' },
  finishBtn: { backgroundColor: '#8FAF7E' },
  navBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.05)' },
  navBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  navBtnTextDisabled: { color: '#666' },
  errorText: { color: '#fff', fontSize: 18, textAlign: 'center', marginTop: 100, marginBottom: 20 },
  backBtn: { backgroundColor: '#E8A020', padding: 14, borderRadius: 10, marginHorizontal: 40, alignItems: 'center' },
  backBtnText: { color: '#fff', fontWeight: '700' },
});
