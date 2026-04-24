import React, { useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../stores/useAuthStore';
import { supabase } from '../lib/supabase';

interface Props {
  compact?: boolean;
}

export default function FamilySizeSelector({ compact = false }: Props): React.ReactElement {
  const familySize = useAuthStore((s) => s.familySize);
  const setFamilySize = useAuthStore((s) => s.setFamilySize);
  const user = useAuthStore((s) => s.user);

  const minusScale = useRef(new Animated.Value(1)).current;
  const plusScale = useRef(new Animated.Value(1)).current;

  const animateButton = (scale: Animated.Value): void => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 0.82,
        useNativeDriver: true,
        speed: 50,
        bounciness: 0,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 10,
      }),
    ]).start();
  };

  const upsertToSupabase = async (newSize: number): Promise<void> => {
    if (!user?.id) return;
    try {
      await supabase
        .from('profiles')
        .upsert({ user_id: user.id, family_size: newSize }, { onConflict: 'user_id' });
    } catch (error) {
      console.error('[FamilySizeSelector] upsert error:', error);
    }
  };

  const handleDecrement = (): void => {
    if (familySize <= 1) return;
    const newSize = familySize - 1;
    animateButton(minusScale);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFamilySize(newSize);
    void upsertToSupabase(newSize);
  };

  const handleIncrement = (): void => {
    if (familySize >= 10) return;
    const newSize = familySize + 1;
    animateButton(plusScale);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFamilySize(newSize);
    void upsertToSupabase(newSize);
  };

  const containerStyle = compact ? styles.containerCompact : styles.container;
  const buttonStyle = compact ? styles.buttonCompact : styles.button;
  const buttonTextStyle = compact ? styles.buttonTextCompact : styles.buttonText;
  const countStyle = compact ? styles.countCompact : styles.count;
  const labelStyle = compact ? styles.labelCompact : styles.label;

  return (
    <View style={containerStyle}>
      {!compact && <Text style={labelStyle}>Family Size</Text>}
      <View style={styles.row}>
        <Animated.View style={{ transform: [{ scale: minusScale }] }}>
          <Pressable
            onPress={handleDecrement}
            disabled={familySize <= 1}
            style={({ pressed }) => [
              buttonStyle,
              familySize <= 1 && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            accessibilityLabel="Decrease family size"
            accessibilityRole="button"
          >
            <Text style={buttonTextStyle}>–</Text>
          </Pressable>
        </Animated.View>

        <View style={compact ? styles.countWrapperCompact : styles.countWrapper}>
          <Text style={countStyle}>{familySize}</Text>
          {!compact && <Text style={styles.unit}>people</Text>}
        </View>

        <Animated.View style={{ transform: [{ scale: plusScale }] }}>
          <Pressable
            onPress={handleIncrement}
            disabled={familySize >= 10}
            style={({ pressed }) => [
              buttonStyle,
              familySize >= 10 && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            accessibilityLabel="Increase family size"
            accessibilityRole="button"
          >
            <Text style={buttonTextStyle}>+</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
  },
  containerCompact: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2B4A',
    letterSpacing: 0.3,
  },
  labelCompact: {
    fontSize: 12,
    color: '#6B7280',
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A2B4A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonCompact: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A2B4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 26,
    textAlign: 'center',
  },
  buttonTextCompact: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 22,
    textAlign: 'center',
  },
  countWrapper: {
    alignItems: 'center',
    minWidth: 60,
  },
  countWrapperCompact: {
    alignItems: 'center',
    minWidth: 36,
  },
  count: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A2B4A',
    lineHeight: 38,
  },
  countCompact: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  unit: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: -2,
  },
});
