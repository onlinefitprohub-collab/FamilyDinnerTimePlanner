import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { useRecipeLibrary } from '../../../src/hooks/useRecipeLibrary';
import { useAuthStore } from '../../../src/stores/useAuthStore';
import { useCookHistoryStore } from '../../../src/stores/useCookHistoryStore';
import { useFavouritesStore } from '../../../src/stores/useFavouritesStore';
import { getIngredientById } from '../../../src/data/ingredients';

function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    setRemaining(seconds);
    setPaused(false);
  }, [seconds]);

  const pause = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    setPaused(false);
  }, []);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRemaining(null);
    setPaused(false);
  }, []);

  useEffect(() => {
    if (remaining === null || paused) return;
    if (remaining <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((r) => (r !== null ? r - 1 : null));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [remaining, paused]);

  useEffect(() => {
    reset();
  }, [seconds, reset]);

  return {
    remaining,
    start,
    pause,
    resume,
    reset,
    isRunning: remaining !== null && remaining > 0 && !paused,
    isPaused: remaining !== null && remaining > 0 && paused,
    isDone: remaining === 0,
  };
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function CookingModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getRecipeById } = useRecipeLibrary();
  const familySize = useAuthStore((s) => s.familySize);
  const addCook = useCookHistoryStore((s) => s.addCook);
  const setRating = useFavouritesStore((s) => s.setRating);
  const existingRating = useFavouritesStore((s) => s.ratings[id ?? ''] ?? 0);
  const [showPrep, setShowPrep] = useState(true);
  const [gatheredIds, setGatheredIds] = useState<Set<string>>(new Set());
  const [currentStep, setCurrentStep] = useState(0);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [pendingRating, setPendingRating] = useState(0);

  const recipe = getRecipeById(id ?? '');

  useEffect(() => {
    activateKeepAwakeAsync();
    return () => { void deactivateKeepAwake(); };
  }, []);

  const step = recipe?.steps[currentStep];
  const durationSecs = step?.duration ? step.duration * 60 : 0;
  const timer = useCountdown(durationSecs);

  // All useCallback hooks must be declared before any conditional return
  const handleFinish = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (id) addCook(id);
    setPendingRating(existingRating);
    setShowRatingModal(true);
  }, [id, addCook, existingRating]);

  const handleRatingSave = useCallback(() => {
    if (id && pendingRating > 0) setRating(id, pendingRating);
    setShowRatingModal(false);
    router.back();
  }, [id, pendingRating, setRating, router]);

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
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const scale = familySize / 4;

  // Prep panel — shown before step 1
  if (showPrep) {
    const allGathered = gatheredIds.size === recipe.ingredients.length;
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
            <Text style={styles.progressText}>{recipe.name}</Text>
          </View>

          <Text style={styles.prepTitle}>Gather Your Ingredients</Text>
          <Text style={styles.prepSubtitle}>
            Tick each one off before you start · {familySize} {familySize === 1 ? 'person' : 'people'}
          </Text>

          <ScrollView style={styles.prepList} contentContainerStyle={styles.prepListContent}>
            {recipe.ingredients.map((ri) => {
              const ing = getIngredientById(ri.ingredientId);
              const name = ing?.name ?? ri.ingredientId;
              const qty = Math.ceil(ri.quantityPer4 * scale);
              const checked = gatheredIds.has(ri.ingredientId);
              return (
                <Pressable
                  key={ri.ingredientId}
                  onPress={() =>
                    setGatheredIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(ri.ingredientId)) next.delete(ri.ingredientId);
                      else next.add(ri.ingredientId);
                      return next;
                    })
                  }
                  style={[styles.prepRow, checked && styles.prepRowChecked]}
                >
                  <View style={[styles.prepCheck, checked && styles.prepCheckDone]}>
                    {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={[styles.prepIngredientName, checked && styles.prepIngredientDone]}>
                    {name}
                  </Text>
                  <Text style={styles.prepQty}>{qty} {ri.unit}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.prepFooter}>
            <Text style={styles.prepCountText}>
              {gatheredIds.size} / {recipe.ingredients.length} gathered
            </Text>
            <Pressable
              onPress={() => setShowPrep(false)}
              style={[styles.prepStartBtn, !allGathered && styles.prepStartBtnPartial]}
            >
              <Ionicons name="flame-outline" size={20} color={allGathered ? '#1A2B4A' : '#fff'} />
              <Text style={[styles.prepStartBtnText, !allGathered && styles.prepStartBtnTextPartial]}>
                {allGathered ? 'Start Cooking' : 'Start Anyway'}
              </Text>
            </Pressable>
          </View>
        </View>
      </>
    );
  }

  const handleNext = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isLast) { handleFinish(); return; }
    setCurrentStep((s) => s + 1);
  };

  const handlePrev = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isFirst) setCurrentStep((s) => s - 1);
  };

  const timerDisplay = timer.remaining !== null
    ? formatTime(Math.max(0, timer.remaining))
    : step?.duration
      ? formatTime(step.duration * 60)
      : null;

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
            <Text style={styles.stepNumberText}>{step?.stepNumber}</Text>
          </View>

          <Text style={styles.instruction}>{step?.instruction}</Text>

          {/* Timer */}
          {step?.duration && timerDisplay !== null && (
            <View style={styles.timerBlock}>
              <Text style={[
                styles.timerDisplay,
                timer.isDone && styles.timerDone,
                timer.isPaused && styles.timerPaused,
              ]}>
                {timer.isDone ? '✓ Done!' : timerDisplay}
              </Text>
              {timer.isPaused && (
                <Text style={styles.pausedLabel}>PAUSED</Text>
              )}
              <View style={styles.timerBtns}>
                {!timer.isRunning && !timer.isPaused && !timer.isDone && (
                  <Pressable onPress={timer.start} style={styles.timerStartBtn}>
                    <Ionicons name="play" size={16} color="#1A2B4A" />
                    <Text style={styles.timerStartText}>Start Timer</Text>
                  </Pressable>
                )}
                {timer.isRunning && (
                  <>
                    <Pressable onPress={timer.pause} style={styles.timerStartBtn}>
                      <Ionicons name="pause" size={16} color="#1A2B4A" />
                      <Text style={styles.timerStartText}>Pause</Text>
                    </Pressable>
                    <Pressable onPress={timer.reset} style={styles.timerResetBtn}>
                      <Ionicons name="stop" size={16} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.timerResetText}>Stop</Text>
                    </Pressable>
                  </>
                )}
                {timer.isPaused && (
                  <>
                    <Pressable onPress={timer.resume} style={styles.timerStartBtn}>
                      <Ionicons name="play" size={16} color="#1A2B4A" />
                      <Text style={styles.timerStartText}>Resume</Text>
                    </Pressable>
                    <Pressable onPress={timer.reset} style={styles.timerResetBtn}>
                      <Ionicons name="stop" size={16} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.timerResetText}>Stop</Text>
                    </Pressable>
                  </>
                )}
                {timer.isDone && (
                  <Pressable onPress={timer.reset} style={styles.timerResetBtn}>
                    <Ionicons name="refresh" size={16} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.timerResetText}>Reset</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {step?.tip && (
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

      {/* Post-cooking rating modal */}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="slide"
        onRequestClose={handleRatingSave}
      >
        <View style={styles.ratingOverlay}>
          <View style={styles.ratingSheet}>
            <Text style={styles.ratingTitle}>How was it?</Text>
            <Text style={styles.ratingSubtitle}>{recipe.name}</Text>
            <View style={styles.ratingStarsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => setPendingRating(star)}
                  hitSlop={8}
                >
                  <Text style={[styles.ratingStar, pendingRating >= star && styles.ratingStarFilled]}>
                    {pendingRating >= star ? '★' : '☆'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={handleRatingSave}
              style={({ pressed }) => [styles.ratingDoneBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ratingDoneBtnText}>
                {pendingRating > 0 ? 'Save & Done' : 'Skip'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  stepContent: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 20 },
  stepNumberCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E8A020', justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },
  stepNumberText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  instruction: { fontSize: 22, color: '#fff', lineHeight: 34, textAlign: 'center' },
  timerBlock: { alignItems: 'center', gap: 10 },
  timerDisplay: { fontSize: 48, fontWeight: '800', color: '#E8A020', letterSpacing: 2, fontVariant: ['tabular-nums'] },
  timerDone: { color: '#8FAF7E', fontSize: 32 },
  timerPaused: { opacity: 0.5 },
  pausedLabel: { color: '#E8A020', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  timerBtns: { flexDirection: 'row', gap: 10 },
  timerStartBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E8A020', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  timerStartText: { color: '#1A2B4A', fontWeight: '700', fontSize: 14 },
  timerResetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  timerResetText: { color: 'rgba(255,255,255,0.8)', fontWeight: '600', fontSize: 14 },
  tipBox: { backgroundColor: 'rgba(232,160,32,0.15)', borderLeftWidth: 3, borderLeftColor: '#E8A020', borderRadius: 8, padding: 14 },
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
  prepTitle: { fontSize: 22, fontWeight: '800', color: '#fff', paddingHorizontal: 24, marginTop: 8 },
  prepSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.55)', paddingHorizontal: 24, marginTop: 4, marginBottom: 16 },
  prepList: { flex: 1 },
  prepListContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  prepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  prepRowChecked: { backgroundColor: 'rgba(143,175,126,0.18)' },
  prepCheck: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  prepCheckDone: { backgroundColor: '#8FAF7E', borderColor: '#8FAF7E' },
  prepIngredientName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#fff' },
  prepIngredientDone: { color: 'rgba(255,255,255,0.45)', textDecorationLine: 'line-through' },
  prepQty: { fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  prepFooter: {
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    paddingTop: 12, gap: 10,
  },
  prepCountText: { textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  prepStartBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#E8A020', borderRadius: 14, paddingVertical: 16,
  },
  prepStartBtnPartial: { backgroundColor: 'rgba(255,255,255,0.15)' },
  prepStartBtnText: { fontSize: 16, fontWeight: '800', color: '#1A2B4A' },
  prepStartBtnTextPartial: { color: '#fff' },
  ratingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  ratingSheet: {
    backgroundColor: '#1A2B4A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: Platform.OS === 'ios' ? 48 : 28,
    alignItems: 'center',
    gap: 14,
  },
  ratingTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  ratingSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  ratingStarsRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 8,
  },
  ratingStar: {
    fontSize: 44,
    color: 'rgba(255,255,255,0.25)',
  },
  ratingStarFilled: {
    color: '#E8A020',
  },
  ratingDoneBtn: {
    backgroundColor: '#E8A020',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 48,
    marginTop: 4,
  },
  ratingDoneBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A2B4A',
  },
});
