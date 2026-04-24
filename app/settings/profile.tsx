import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { upsertProfile } from '../../src/services/supabaseService';
import { supabase } from '../../src/lib/supabase';

const MIN_FAMILY_SIZE = 1;
const MAX_FAMILY_SIZE = 12;

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const familySize = useAuthStore((s) => s.familySize);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setFamilySize = useAuthStore((s) => s.setFamilySize);

  const [familyName, setFamilyName] = useState('');
  const [size, setSize] = useState(4);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPw, setIsChangingPw] = useState(false);

  useEffect(() => {
    setFamilyName(profile?.familyName ?? '');
    setSize(familySize);
    setEmail(user?.email ?? '');
  }, [profile, familySize, user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!familyName.trim()) {
      Alert.alert('Missing info', 'Please enter a family name.');
      return;
    }
    setIsSaving(true);
    try {
      await upsertProfile({ userId: user.id, familyName: familyName.trim(), familySize: size });
      setProfile({ userId: user.id, familyName: familyName.trim(), familySize: size });
      setFamilySize(size);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      Alert.alert('Too short', 'Password must be at least 6 characters.');
      return;
    }
    setIsChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      Alert.alert('Password updated', 'Your password has been changed successfully.');
    } catch {
      Alert.alert('Error', 'Failed to update password. Please try again.');
    } finally {
      setIsChangingPw(false);
    }
  };

  const adjustSize = (delta: number) => {
    setSize((s) => Math.max(MIN_FAMILY_SIZE, Math.min(MAX_FAMILY_SIZE, s + delta)));
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'My Profile',
          headerStyle: { backgroundColor: '#FAFAF8' },
          headerTitleStyle: { color: '#1A2B4A' },
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>

          {/* Account info */}
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.card}>
            <View style={styles.emailRow}>
              <Ionicons name="mail-outline" size={18} color="#6B7280" />
              <Text style={styles.emailText}>{email || 'No email'}</Text>
            </View>
          </View>

          {/* Family profile */}
          <Text style={styles.sectionTitle}>FAMILY PROFILE</Text>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Family Name</Text>
              <TextInput
                style={styles.input}
                value={familyName}
                onChangeText={setFamilyName}
                placeholder="e.g. The Smiths"
                placeholderTextColor="#9CA3AF"
                returnKeyType="done"
              />
            </View>
            <View style={[styles.fieldRow, styles.fieldRowBorder]}>
              <Text style={styles.fieldLabel}>Cooking For</Text>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => adjustSize(-1)}
                  style={[styles.stepBtn, size <= MIN_FAMILY_SIZE && styles.stepBtnDisabled]}
                  disabled={size <= MIN_FAMILY_SIZE}
                >
                  <Ionicons name="remove" size={20} color={size <= MIN_FAMILY_SIZE ? '#D1D5DB' : '#1A2B4A'} />
                </Pressable>
                <Text style={styles.stepValue}>{size} {size === 1 ? 'person' : 'people'}</Text>
                <Pressable
                  onPress={() => adjustSize(1)}
                  style={[styles.stepBtn, size >= MAX_FAMILY_SIZE && styles.stepBtnDisabled]}
                  disabled={size >= MAX_FAMILY_SIZE}
                >
                  <Ionicons name="add" size={20} color={size >= MAX_FAMILY_SIZE ? '#D1D5DB' : '#1A2B4A'} />
                </Pressable>
              </View>
            </View>
            <Pressable style={styles.saveBtn} onPress={handleSaveProfile} disabled={isSaving}>
              {isSaving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>Save Profile</Text>
              }
            </Pressable>
          </View>

          {/* Change password */}
          <Text style={styles.sectionTitle}>SECURITY</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>New Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password…"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#6B7280" />
              </Pressable>
            </View>
            <Text style={styles.passwordHint}>Minimum 6 characters.</Text>
            <Pressable
              style={[styles.saveBtn, styles.saveBtnSecondary]}
              onPress={handleChangePassword}
              disabled={isChangingPw}
            >
              {isChangingPw
                ? <ActivityIndicator color="#1A2B4A" />
                : <Text style={styles.saveBtnTextSecondary}>Update Password</Text>
              }
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  content: { paddingBottom: 48 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 24, marginBottom: 8, paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    overflow: 'hidden', padding: 16, gap: 12,
  },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emailText: { fontSize: 15, color: '#1A2B4A', fontWeight: '500' },
  fieldRow: { gap: 6 },
  fieldRowBorder: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.3 },
  input: {
    backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: '#1A2B4A',
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center',
  },
  stepBtnDisabled: { backgroundColor: '#F3F4F6' },
  stepValue: { fontSize: 16, fontWeight: '700', color: '#1A2B4A', minWidth: 80, textAlign: 'center' },
  saveBtn: {
    backgroundColor: '#1A2B4A', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  saveBtnSecondary: { backgroundColor: '#F3F4F6' },
  saveBtnTextSecondary: { color: '#1A2B4A', fontWeight: '700', fontSize: 15 },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 10,
  },
  passwordInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#1A2B4A' },
  eyeBtn: { padding: 12 },
  passwordHint: { fontSize: 11, color: '#9CA3AF', marginTop: -4 },
});
