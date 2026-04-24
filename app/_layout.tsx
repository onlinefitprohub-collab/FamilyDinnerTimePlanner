import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { useAuth } from '../src/hooks/useAuth';

function AuthGate({ children }: { children: React.ReactNode }): React.ReactElement {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E8A020" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout(): React.ReactElement {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces: require('../assets/fonts/Fraunces.ttf'),
    SourceSans3: require('../assets/fonts/SourceSans3.ttf'),
  } as Record<string, number>);

  if (!fontsLoaded && !fontError) {
    // Fall back to system fonts — warn in dev
    if (__DEV__) {
      console.warn(
        '[RootLayout] Custom fonts not yet loaded. ' +
          'Ensure font files are placed in assets/fonts/ or will use system fallback.',
      );
    }
  }

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
