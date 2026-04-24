import React, { useState, useCallback } from 'react';
import {
  Modal, View, Text, Pressable, ActivityIndicator, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BarcodeScanner from './BarcodeScanner';
import { lookupBarcode, BarcodeResult } from '../services/openFoodFacts';
import { useScanStore } from '../stores/useScanStore';
import { useAuthStore } from '../stores/useAuthStore';

export type ScanAction = 'pantry' | 'shopping' | 'freezer' | 'budget';

interface Props {
  visible: boolean;
  action: ScanAction;
  onClose: () => void;
  onResult: (result: BarcodeResult) => void;
}

export default function BarcodeScanModal({ visible, action, onClose, onResult }: Props) {
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [result, setResult] = useState<BarcodeResult | null>(null);
  const addScan = useScanStore((s) => s.addScan);
  const user = useAuthStore((s) => s.user);

  const handleDetected = useCallback(async (barcode: string) => {
    if (isLookingUp) return;
    setIsLookingUp(true);
    try {
      const res = await lookupBarcode(barcode);
      setResult(res);

      if (user) {
        await addScan({
          userId: user.id,
          barcode,
          productName: res.productName,
          matchedIngredientId: res.matchedIngredientId ?? undefined,
          scannedAt: new Date().toISOString(),
          action,
        });
      }
    } catch {
      Alert.alert('Lookup failed', 'Could not look up this barcode. Try again.');
      setIsLookingUp(false);
    } finally {
      setIsLookingUp(false);
    }
  }, [isLookingUp, user, addScan, action]);

  const handleConfirm = () => {
    if (!result) return;
    onResult(result);
    setResult(null);
    onClose();
  };

  const handleRetry = () => {
    setResult(null);
    setIsLookingUp(false);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {!result && !isLookingUp && (
        <BarcodeScanner onDetected={handleDetected} onClose={onClose} />
      )}

      {isLookingUp && (
        <View style={styles.lookupOverlay}>
          <ActivityIndicator size="large" color="#E8A020" />
          <Text style={styles.lookupText}>Looking up barcode…</Text>
        </View>
      )}

      {result && !isLookingUp && (
        <View style={styles.resultContainer}>
          <View style={styles.resultCard}>
            <Pressable onPress={handleRetry} style={styles.retryBtn}>
              <Ionicons name="arrow-back" size={22} color="#1A2B4A" />
            </Pressable>

            <View style={styles.resultIcon}>
              <Ionicons name="barcode-outline" size={40} color="#1A2B4A" />
            </View>
            <Text style={styles.productName}>{result.productName}</Text>
            {result.brands && (
              <Text style={styles.brandName}>{result.brands}</Text>
            )}
            <Text style={styles.cacheLabel}>
              {result.fromCache ? '(from cache)' : '(from Open Food Facts)'}
            </Text>

            {result.matchedIngredientName ? (
              <View style={styles.matchBox}>
                <Ionicons name="checkmark-circle" size={20} color="#8FAF7E" />
                <Text style={styles.matchText}>
                  Matched: <Text style={styles.matchName}>{result.matchedIngredientName}</Text>
                </Text>
              </View>
            ) : (
              <View style={[styles.matchBox, styles.noMatchBox]}>
                <Ionicons name="alert-circle" size={20} color="#E8A020" />
                <Text style={styles.noMatchText}>
                  No ingredient match found — will be added as-is
                </Text>
              </View>
            )}

            <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>
                {ACTION_LABELS[action]}
              </Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Modal>
  );
}

const ACTION_LABELS: Record<ScanAction, string> = {
  pantry: 'Mark as In Stock',
  shopping: 'Add to Shopping List',
  freezer: 'Log to Freezer',
  budget: 'Compare Prices',
};

const styles = StyleSheet.create({
  lookupOverlay: {
    flex: 1, backgroundColor: '#1A2B4A',
    justifyContent: 'center', alignItems: 'center', gap: 16,
  },
  lookupText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resultContainer: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  resultCard: {
    backgroundColor: '#FAFAF8', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 48, gap: 12,
  },
  retryBtn: {
    position: 'absolute', top: 16, left: 16,
    backgroundColor: '#EEF1F7', borderRadius: 20, padding: 8,
  },
  resultIcon: { alignItems: 'center', marginTop: 16, marginBottom: 4 },
  productName: { fontSize: 20, fontWeight: '800', color: '#1A2B4A', textAlign: 'center' },
  brandName: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: -6 },
  cacheLabel: { fontSize: 11, color: '#D1D5DB', textAlign: 'center' },
  matchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FBF0', borderRadius: 10, padding: 12,
  },
  noMatchBox: { backgroundColor: '#FFFBF0' },
  matchText: { flex: 1, fontSize: 14, color: '#374151' },
  matchName: { fontWeight: '700', color: '#1A2B4A' },
  noMatchText: { flex: 1, fontSize: 14, color: '#6B7280' },
  confirmBtn: {
    backgroundColor: '#E8A020', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: '#6B7280', fontWeight: '600', fontSize: 15 },
});
