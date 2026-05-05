import React from 'react';
import {
  View,
  Text,
  Pressable,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FONTS } from '../../src/theme/typography';

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

function WebSidebar(): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={sidebarStyles.container}>
      <View style={sidebarStyles.brand}>
        <Text style={sidebarStyles.brandEmoji}>🍽️</Text>
        <Text style={sidebarStyles.brandName}>Family{'\n'}Planner</Text>
      </View>

      <View style={sidebarStyles.nav}>
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
                sidebarStyles.navItem,
                isActive && sidebarStyles.navItemActive,
                pressed && sidebarStyles.navItemPressed,
              ]}
              accessibilityRole="link"
              accessibilityLabel={tab.label}
            >
              <Ionicons
                name={tab.icon}
                size={22}
                color={isActive ? ACTIVE_TINT : INACTIVE_TINT}
              />
              <Text style={[sidebarStyles.navLabel, isActive && sidebarStyles.navLabelActive]}>
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
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 768;

  if (isDesktopWeb) {
    return (
      <View style={styles.webRoot}>
        <WebSidebar />
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
    fontFamily: FONTS.bodySemiBold,
  },
  webRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  webContent: {
    flex: 1,
  },
});

const sidebarStyles = StyleSheet.create({
  container: {
    width: 220,
    backgroundColor: '#1A2B4A',
    paddingTop: 24,
    paddingBottom: 32,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  brandEmoji: {
    fontSize: 28,
  },
  brandName: {
    fontSize: 15,
    fontFamily: FONTS.headingBold,
    color: '#FFFFFF',
    lineHeight: 19,
  },
  nav: {
    gap: 2,
    paddingHorizontal: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: 'rgba(232,160,32,0.18)',
  },
  navItemPressed: {
    opacity: 0.7,
  },
  navLabel: {
    fontSize: 15,
    fontFamily: FONTS.bodySemiBold,
    color: 'rgba(255,255,255,0.65)',
  },
  navLabelActive: {
    fontFamily: FONTS.bodyBold,
    color: ACTIVE_TINT,
  },
});
