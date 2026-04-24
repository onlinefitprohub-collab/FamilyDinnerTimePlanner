import { Stack } from 'expo-router';
export default function RecipesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FAFAF8' },
        headerTitleStyle: { color: '#1A2B4A', fontWeight: '700' },
      }}
    />
  );
}
