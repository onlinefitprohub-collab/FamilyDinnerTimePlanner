import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';

const COLORS = {
  background: '#FAFAF8',
  primary: '#1A2B4A',
  accent: '#E8A020',
  sage: '#8FAF7E',
  danger: '#C0392B',
  border: '#D1D5DB',
  placeholder: '#9CA3AF',
  white: '#FFFFFF',
  mutedText: '#6B7280',
} as const;

export default function RegisterScreen(): React.ReactElement {
  const router = useRouter();

  const [familyName, setFamilyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function validate(): string | null {
    if (!familyName.trim()) return 'Please enter your family name.';
    if (!email.trim()) return 'Please enter your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    return null;
  }

  async function handleCreateAccount(): Promise<void> {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            family_name: familyName.trim(),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.user) {
        // Insert initial profile row
        const { error: profileError } = await supabase.from('profiles').insert({
          user_id: data.user.id,
          family_name: familyName.trim(),
          family_size: 4,
        });

        if (profileError && profileError.code !== '23505') {
          // Ignore duplicate key errors (profile may already exist via trigger)
          console.error('[Register] profile insert error:', profileError);
        }
      }

      // If email confirmation is required, show a success message
      if (data.session) {
        // Logged in immediately (email confirmation disabled)
        router.replace('/(tabs)');
      } else {
        setSuccessMessage(
          'Account created! Please check your email to confirm your address, then sign in.',
        );
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('[Register] signUp error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
            </Pressable>
          </View>

          {/* Title */}
          <View style={styles.titleArea}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Start planning family meals today</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Family Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Family Name</Text>
              <TextInput
                style={styles.input}
                value={familyName}
                onChangeText={(t: string) => {
                  setFamilyName(t);
                  if (error) setError(null);
                }}
                placeholder="e.g. The Smiths"
                placeholderTextColor={COLORS.placeholder}
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="organizationName"
                returnKeyType="next"
                editable={!isLoading}
              />
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(t: string) => {
                  setEmail(t);
                  if (error) setError(null);
                }}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                autoComplete="email"
                returnKeyType="next"
                editable={!isLoading}
              />
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={(t: string) => {
                    setPassword(t);
                    if (error) setError(null);
                  }}
                  placeholder="Minimum 8 characters"
                  placeholderTextColor={COLORS.placeholder}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                  autoComplete="new-password"
                  returnKeyType="done"
                  onSubmitEditing={handleCreateAccount}
                  editable={!isLoading}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((v: boolean) => !v)}
                  hitSlop={8}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={COLORS.mutedText}
                  />
                </Pressable>
              </View>
              <Text style={styles.passwordHint}>Must be at least 8 characters</Text>
            </View>

            {/* Error Message */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Success Message */}
            {successMessage ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.sage} />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            {/* Create Account Button */}
            <Pressable
              style={({ pressed }: { pressed: boolean }) => [
                styles.createButton,
                pressed && styles.createButtonPressed,
                isLoading && styles.createButtonDisabled,
              ]}
              onPress={handleCreateAccount}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Create account"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.createButtonText}>Create Account</Text>
              )}
            </Pressable>
          </View>

          {/* Login Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Pressable
              onPress={() => router.replace('/(auth)/login')}
              disabled={isLoading}
            >
              <Text style={styles.footerLink}>Sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },

  // Header
  header: {
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  // Title
  titleArea: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.mutedText,
    marginTop: 6,
  },

  // Form
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: COLORS.primary,
    backgroundColor: COLORS.white,
  },

  // Password
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  passwordInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 14,
    fontSize: 16,
    color: COLORS.primary,
  },
  eyeButton: {
    paddingHorizontal: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passwordHint: {
    fontSize: 12,
    color: COLORS.mutedText,
    marginTop: 2,
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.danger,
    lineHeight: 18,
  },

  // Success
  successBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F0FAF0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  successText: {
    flex: 1,
    fontSize: 13,
    color: '#166534',
    lineHeight: 18,
  },

  // Create Button
  createButton: {
    height: 52,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.3,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 15,
    color: COLORS.mutedText,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.accent,
  },
});
