import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../src/hooks/useAuth';
import { ONBOARDING_KEY } from './onboarding';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function useNotificationDeepLink() {
  const router = useRouter();
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // Handle taps on notifications that arrive while app is backgrounded/closed
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | { route?: string; params?: Record<string, string> }
          | undefined;
        if (!data?.route) return;

        const route = data.params
          ? `${data.route}?${new URLSearchParams(data.params).toString()}`
          : data.route;

        // Small delay to let the navigator mount
        setTimeout(() => {
          router.push(route as Parameters<typeof router.push>[0]);
        }, 300);
      },
    );

    return () => {
      responseListener.current?.remove();
    };
  }, [router]);
}

function AuthGate({ children }: { children: React.ReactNode }): React.ReactElement {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useNotificationDeepLink();

  // Load onboarding flag once
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((v) => {
      setOnboardingDone(v === 'true');
      setOnboardingChecked(true);
    });
  }, []);

  useEffect(() => {
    if (isLoading || !onboardingChecked) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      if (onboardingDone) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    } else if (session && !inAuthGroup && !inOnboarding && !onboardingDone) {
      router.replace('/onboarding');
    }
  }, [session, isLoading, segments, router, onboardingChecked, onboardingDone]);

  if (isLoading || !onboardingChecked) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E8A020" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthGate>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAF8',
  },
});
