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

export default function ForgotPasswordScreen(): React.ReactElement {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSendResetLink(): Promise<void> {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: 'familydinnerplanner://reset-password',
        },
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSent(true);
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('[ForgotPassword] resetPasswordForEmail error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  if (sent) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.successContainer}>
          {/* Back */}
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

          <View style={styles.successContent}>
            <View style={styles.successIconCircle}>
              <Ionicons name="mail-outline" size={40} color={COLORS.accent} />
            </View>
            <Text style={styles.successTitle}>Check Your Email</Text>
            <Text style={styles.successBody}>
              We've sent a password reset link to{' '}
              <Text style={styles.successEmail}>{email.trim().toLowerCase()}</Text>.
              {'\n\n'}
              Follow the link in the email to reset your password. The link expires after 1 hour.
            </Text>
            <Text style={styles.successNote}>
              Don't see it? Check your spam folder.
            </Text>

            <Pressable
              style={({ pressed }: { pressed: boolean }) => [
                styles.backToLoginButton,
                pressed && styles.backToLoginButtonPressed,
              ]}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={styles.backToLoginText}>Back to Sign In</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
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
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              Enter your email and we'll send you a link to reset your password.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
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
                returnKeyType="done"
                onSubmitEditing={handleSendResetLink}
                editable={!isLoading}
                autoFocus
              />
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Send Button */}
            <Pressable
              style={({ pressed }: { pressed: boolean }) => [
                styles.sendButton,
                pressed && styles.sendButtonPressed,
                isLoading && styles.sendButtonDisabled,
              ]}
              onPress={handleSendResetLink}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Send reset link"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.sendButtonText}>Send Reset Link</Text>
              )}
            </Pressable>
          </View>

          {/* Back to Login */}
          <View style={styles.footer}>
            <Pressable
              onPress={() => router.replace('/(auth)/login')}
              disabled={isLoading}
            >
              <Text style={styles.footerLink}>Back to Sign In</Text>
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
    marginTop: 8,
    lineHeight: 22,
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

  // Send Button
  sendButton: {
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
  sendButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.3,
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.accent,
  },

  // Success state
  successContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
  },
  successIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#FED7AA',
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  successBody: {
    fontSize: 15,
    color: COLORS.mutedText,
    textAlign: 'center',
    lineHeight: 23,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  successEmail: {
    fontWeight: '600',
    color: COLORS.primary,
  },
  successNote: {
    fontSize: 13,
    color: COLORS.placeholder,
    textAlign: 'center',
    marginBottom: 40,
  },
  backToLoginButton: {
    height: 52,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  backToLoginButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  backToLoginText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.3,
  },
});
