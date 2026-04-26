import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useScanStore } from '../../src/stores/useScanStore';
import { getIngredientById } from '../../src/data/ingredients';
import { ScanHistoryEntry } from '../../src/types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ScanHistoryScreen(): React.ReactElement {
  const router = useRouter();
  const history = useScanStore((s) => s.history);
  const clearHistory = useScanStore((s) => s.clearHistory);
  const isLoading = useScanStore((s) => s.isLoading);

  const handleClear = useCallback(() => {
    Alert.alert(
      'Clear Scan History',
      'Remove all scanned items? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: () => void clearHistory() },
      ],
    );
  }, [clearHistory]);

  const renderItem = useCallback(({ item }: { item: ScanHistoryEntry }) => {
    const isMatched = !!item.matchedIngredientId;
    return (
      <View style={styles.row}>
        <View style={[styles.iconWrap, isMatched ? styles.iconWrapMatched : styles.iconWrapUnmatched]}>
          <Ionicons
            name={isMatched ? 'checkmark' : 'close'}
            size={16}
            color={isMatched ? '#8FAF7E' : '#9CA3AF'}
          />
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.productName} numberOfLines={1}>{item.productName}</Text>
          {isMatched ? (
            <Text style={styles.matchedLabel}>✓ Matched: {getIngredientById(item.matchedIngredientId!)?.name ?? item.matchedIngredientId}</Text>
          ) : (
            <Text style={styles.unmatchedLabel}>No ingredient match found</Text>
          )}
          <View style={styles.metaRow}>
            <View style={[styles.actionBadge, item.action === 'pantry' ? styles.actionPantry : styles.actionFreezer]}>
              <Text style={styles.actionBadgeText}>
                {item.action === 'pantry' ? '🧺 Pantry' : '❄️ Freezer'}
              </Text>
            </View>
            <Text style={styles.dateText}>{formatDate(item.scannedAt)}</Text>
          </View>
        </View>
      </View>
    );
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#1A2B4A" />
          </Pressable>
          <Text style={styles.screenTitle}>Scan History</Text>
          {history.length > 0 ? (
            <Pressable onPress={handleClear} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}
        </View>

        {/* Stats strip */}
        {history.length > 0 && (
          <View style={styles.statsStrip}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{history.length}</Text>
              <Text style={styles.statLabel}>Total scans</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {history.filter((h) => !!h.matchedIngredientId).length}
              </Text>
              <Text style={styles.statLabel}>Matched</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {history.filter((h) => h.action === 'pantry').length}
              </Text>
              <Text style={styles.statLabel}>Pantry adds</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {history.filter((h) => h.action === 'freezer').length}
              </Text>
              <Text style={styles.statLabel}>Freezer adds</Text>
            </View>
          </View>
        )}

        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="barcode-outline" size={52} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No scans yet</Text>
              <Text style={styles.emptyBody}>
                Use the barcode scanner in Pantry or Freezer to add items. Your scan history will appear here.
              </Text>
              <Pressable
                onPress={() => router.push('/pantry' as Parameters<typeof router.push>[0])}
                style={styles.goScanBtn}
              >
                <Text style={styles.goScanBtnText}>Open Pantry</Text>
              </Pressable>
            </View>
          }
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAF8' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 4 : 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 48, justifyContent: 'center' },
  screenTitle: { fontSize: 17, fontWeight: '700', color: '#1A2B4A' },
  clearBtn: { width: 48, alignItems: 'flex-end' },
  clearBtnText: { color: '#C0392B', fontWeight: '600', fontSize: 14 },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#1A2B4A' },
  statLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase' },
  statDivider: { width: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  list: { paddingVertical: 8, paddingHorizontal: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  iconWrapMatched: { backgroundColor: '#F0FDF4' },
  iconWrapUnmatched: { backgroundColor: '#F3F4F6' },
  rowInfo: { flex: 1, gap: 3 },
  productName: { fontSize: 15, fontWeight: '700', color: '#1A2B4A' },
  matchedLabel: { fontSize: 12, color: '#8FAF7E' },
  unmatchedLabel: { fontSize: 12, color: '#9CA3AF' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  actionBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  actionPantry: { backgroundColor: '#FEF3C7' },
  actionFreezer: { backgroundColor: '#E0F2FE' },
  actionBadgeText: { fontSize: 11, fontWeight: '600', color: '#1A2B4A' },
  dateText: { fontSize: 11, color: '#9CA3AF' },
  separator: { height: 1, backgroundColor: '#F3F4F6' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A2B4A' },
  emptyBody: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21 },
  goScanBtn: {
    marginTop: 8,
    backgroundColor: '#1A2B4A',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  goScanBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
