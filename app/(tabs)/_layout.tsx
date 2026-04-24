import React from 'react';
import {
  View,
  Text,
  Pressable,
  Platform,
  StyleSheet,
} from 'react-native';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type TabConfig = {
  name: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  href: string;
};

const TABS: TabConfig[] = [
  { name: 'index', label: 'Home', icon: 'home-outline', href: '/(tabs)' },
  { name: 'recipes', label: 'Recipes', icon: 'restaurant-outline', href: '/(tabs)/recipes' },
  { name: 'planner', label: 'Planner', icon: 'calendar-outline', href: '/(tabs)/planner' },
  { name: 'shopping', label: 'Shopping', icon: 'cart-outline', href: '/(tabs)/shopping' },
  { name: 'more', label: 'More', icon: 'menu-outline', href: '/(tabs)/more' },
];

const ACTIVE_TINT = '#E8A020';
const INACTIVE_TINT = '#6B7280';

function WebTopNav(): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={webStyles.container}>
      <View style={webStyles.inner}>
        {TABS.map((tab) => {
          const isActive =
            tab.name === 'index'
              ? pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/'
              : pathname.startsWith(`/(tabs)/${tab.name}`) || pathname.startsWith(`/${tab.name}`);
          return (
            <Pressable
              key={tab.name}
              onPress={() => router.push(tab.href as Parameters<typeof router.push>[0])}
              style={({ pressed }) => [
                webStyles.navItem,
                isActive && webStyles.navItemActive,
                pressed && webStyles.navItemPressed,
              ]}
              accessibilityRole="link"
              accessibilityLabel={tab.label}
            >
              <Ionicons
                name={tab.icon}
                size={20}
                color={isActive ? ACTIVE_TINT : INACTIVE_TINT}
              />
              <Text style={[webStyles.navLabel, isActive && webStyles.navLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout(): React.ReactElement {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webRoot}>
        <WebTopNav />
        <View style={styles.webContent}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: { display: 'none' },
            }}
          >
            {TABS.map((tab) => (
              <Tabs.Screen key={tab.name} name={tab.name} />
            ))}
          </Tabs>
        </View>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={({ route }) => {
        const tab = TABS.find((t) => t.name === route.name);
        return {
          headerShown: false,
          tabBarActiveTintColor: ACTIVE_TINT,
          tabBarInactiveTintColor: INACTIVE_TINT,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name={tab?.icon ?? 'home-outline'}
              size={size}
              color={color}
            />
          ),
        };
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{ title: tab.label }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  webRoot: {
    flex: 1,
    flexDirection: 'column',
  },
  webContent: {
    flex: 1,
  },
});

const webStyles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  navItemActive: {
    borderBottomColor: ACTIVE_TINT,
  },
  navItemPressed: {
    opacity: 0.7,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: INACTIVE_TINT,
  },
  navLabelActive: {
    color: ACTIVE_TINT,
    fontWeight: '700',
  },
});
