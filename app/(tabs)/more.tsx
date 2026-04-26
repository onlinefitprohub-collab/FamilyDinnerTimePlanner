import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/useAuthStore';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface MenuRow {
  icon: IconName;
  label: string;
  href?: string;
  onPress?: () => void;
  danger?: boolean;
}

interface MenuSection {
  title: string;
  rows: MenuRow[];
}

export default function MoreScreen(): React.ReactElement {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);

  const handleSignOut = (): void => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            void signOut();
          },
        },
      ],
    );
  };

  const sections: MenuSection[] = [
    {
      title: 'Pantry',
      rows: [
        {
          icon: 'basket-outline',
          label: 'Cupboard',
          href: '/pantry',
        },
        {
          icon: 'snow-outline',
          label: 'Freezer',
          href: '/pantry?tab=freezer',
        },
        {
          icon: 'barcode-outline',
          label: 'Scan History',
          href: '/scan-history',
        },
      ],
    },
    {
      title: 'Manage',
      rows: [
        {
          icon: 'wallet-outline',
          label: 'Budget',
          href: '/budget',
        },
        {
          icon: 'heart-outline',
          label: 'Favourites',
          href: '/favourites',
        },
        {
          icon: 'nutrition-outline',
          label: 'Nutrition',
          href: '/nutrition',
        },
      ],
    },
    {
      title: 'Settings',
      rows: [
        {
          icon: 'person-circle-outline',
          label: 'My Profile',
          href: '/settings/profile',
        },
        {
          icon: 'people-outline',
          label: 'Family Profiles',
          href: '/settings/family',
        },
        {
          icon: 'globe-outline',
          label: 'Recipe APIs',
          href: '/settings/apis',
        },
        {
          icon: 'settings-outline',
          label: 'Preferences',
          href: '/settings/preferences',
        },
      ],
    },
    {
      title: 'Account',
      rows: [
        {
          icon: 'log-out-outline',
          label: 'Sign Out',
          onPress: handleSignOut,
          danger: true,
        },
      ],
    },
  ];

  const handleRowPress = (row: MenuRow): void => {
    if (row.onPress) {
      row.onPress();
    } else if (row.href) {
      router.push(row.href as Parameters<typeof router.push>[0]);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.screenTitle}>More</Text>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionHeader}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.rows.map((row, index) => (
                <Pressable
                  key={row.label}
                  onPress={() => handleRowPress(row)}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.rowPressed,
                    index < section.rows.length - 1 && styles.rowBorder,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={row.label}
                >
                  <View style={styles.rowLeft}>
                    <View
                      style={[
                        styles.iconWrap,
                        row.danger && styles.iconWrapDanger,
                      ]}
                    >
                      <Ionicons
                        name={row.icon}
                        size={20}
                        color={row.danger ? '#C0392B' : '#1A2B4A'}
                      />
                    </View>
                    <Text
                      style={[styles.rowLabel, row.danger && styles.rowLabelDanger]}
                    >
                      {row.label}
                    </Text>
                  </View>
                  {!row.danger && (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#D1D5DB"
                    />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A2B4A',
    marginTop: 16,
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowPressed: {
    backgroundColor: '#F9F9F7',
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF1F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDanger: {
    backgroundColor: '#FEF2F2',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A2B4A',
  },
  rowLabelDanger: {
    color: '#C0392B',
  },
});
