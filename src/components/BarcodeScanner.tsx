import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

// Web fallback — manual text entry
function WebScanner({ onDetected, onClose }: Props) {
  const [value, setValue] = useState('');
  return (
    <View style={styles.container}>
      <Pressable style={styles.closeBtn} onPress={onClose}>
        <Ionicons name="close" size={26} color="#1A2B4A" />
      </Pressable>
      <View style={styles.webContent}>
        <Ionicons name="barcode-outline" size={64} color="#1A2B4A" />
        <Text style={styles.webTitle}>Enter Barcode</Text>
        <Text style={styles.webSubtitle}>Camera scanning is not available on web. Enter the barcode number manually.</Text>
        <TextInput
          style={styles.webInput}
          value={value}
          onChangeText={setValue}
          placeholder="e.g. 5000157024398"
          keyboardType="number-pad"
          autoFocus
        />
        <Pressable
          style={[styles.webSubmitBtn, !value && styles.webSubmitBtnDisabled]}
          onPress={() => { if (value.trim()) onDetected(value.trim()); }}
          disabled={!value}
        >
          <Text style={styles.webSubmitBtnText}>Submit</Text>
        </Pressable>
      </View>
      <Text style={styles.privacyNote}>Your camera is used only to read the barcode. No images are stored or shared.</Text>
    </View>
  );
}

// Native scanner using expo-barcode-scanner
function NativeScanner({ onDetected, onClose }: Props) {
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const lastScanned = useRef<{ code: string; time: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    // Dynamic import to avoid web issues
    import('expo-barcode-scanner').then(({ BarCodeScanner }) => {
      BarCodeScanner.requestPermissionsAsync().then(({ status }) => {
        if (mounted) setPermission(status === 'granted' ? 'granted' : 'denied');
      });
    });
    return () => { mounted = false; };
  }, []);

  const handleScan = ({ data }: { data: string }) => {
    const now = Date.now();
    if (lastScanned.current && lastScanned.current.code === data && now - lastScanned.current.time < 2000) return;
    lastScanned.current = { code: data, time: now };
    onDetected(data);
  };

  if (permission === 'unknown') {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#E8A020" />
        <Text style={styles.loadingText}>Requesting camera permission…</Text>
      </View>
    );
  }

  if (permission === 'denied' || manualMode) {
    return (
      <View style={styles.container}>
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
        <View style={styles.webContent}>
          {permission === 'denied' && (
            <Text style={styles.deniedText}>Camera access was denied. Enter the barcode manually or enable camera access in Settings.</Text>
          )}
          <TextInput
            style={styles.webInput}
            value={manualValue}
            onChangeText={setManualValue}
            placeholder="Enter barcode number"
            keyboardType="number-pad"
            autoFocus
          />
          <Pressable
            style={[styles.webSubmitBtn, !manualValue && styles.webSubmitBtnDisabled]}
            onPress={() => { if (manualValue.trim()) onDetected(manualValue.trim()); }}
            disabled={!manualValue}
          >
            <Text style={styles.webSubmitBtnText}>Submit</Text>
          </Pressable>
        </View>
        <Text style={styles.privacyNote}>Your camera is used only to read the barcode. No images are stored or shared.</Text>
      </View>
    );
  }

  // Render the native barcode scanner via dynamic import
  return <DynamicNativeScanner onScan={handleScan} onClose={onClose} onManual={() => setManualMode(true)} />;
}

function DynamicNativeScanner({ onScan, onClose, onManual }: {
  onScan: (d: { data: string }) => void;
  onClose: () => void;
  onManual: () => void;
}) {
  const [BarCodeScannerComp, setComp] = useState<React.ComponentType<Record<string, unknown>> | null>(null);

  useEffect(() => {
    import('expo-barcode-scanner').then(({ BarCodeScanner }) => {
      setComp(() => BarCodeScanner as React.ComponentType<Record<string, unknown>>);
    });
  }, []);

  if (!BarCodeScannerComp) return <ActivityIndicator color="#E8A020" style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <BarCodeScannerComp style={StyleSheet.absoluteFillObject} onBarCodeScanned={onScan} />
      {/* Overlay */}
      <View style={styles.overlay}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.reticle} />
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>
      <Pressable style={styles.closeBtn} onPress={onClose}>
        <Ionicons name="close" size={26} color="#fff" />
      </Pressable>
      <Pressable style={styles.manualBtn} onPress={onManual}>
        <Text style={styles.manualBtnText}>Enter manually</Text>
      </Pressable>
      <Text style={styles.privacyNoteWhite}>Your camera is used only to read the barcode. No images are stored or shared.</Text>
    </View>
  );
}

export default function BarcodeScanner(props: Props) {
  if (Platform.OS === 'web') return <WebScanner {...props} />;
  return <NativeScanner {...props} />;
}

const OVERLAY_COLOR = 'rgba(0,0,0,0.6)';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 52, right: 16, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 22, padding: 8 },
  overlay: { ...StyleSheet.absoluteFillObject },
  overlayTop: { flex: 1, backgroundColor: OVERLAY_COLOR },
  overlayMiddle: { flexDirection: 'row', height: 240 },
  overlaySide: { flex: 1, backgroundColor: OVERLAY_COLOR },
  reticle: { width: 240, height: 240, borderWidth: 2, borderColor: '#E8A020', borderRadius: 8 },
  overlayBottom: { flex: 1, backgroundColor: OVERLAY_COLOR },
  manualBtn: { position: 'absolute', bottom: 80, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  manualBtnText: { color: '#fff', fontWeight: '600' },
  privacyNote: { fontSize: 11, color: '#6B7280', textAlign: 'center', margin: 16, marginTop: 'auto' },
  privacyNoteWhite: { position: 'absolute', bottom: 24, alignSelf: 'center', fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center', paddingHorizontal: 24 },
  loadingText: { color: '#fff', marginTop: 16 },
  deniedText: { color: '#374151', textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  webContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#FAFAF8' },
  webTitle: { fontSize: 22, fontWeight: '700', color: '#1A2B4A', marginTop: 16, marginBottom: 8 },
  webSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  webInput: { width: '100%', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, padding: 14, fontSize: 18, color: '#1A2B4A', backgroundColor: '#fff', textAlign: 'center', marginBottom: 16 },
  webSubmitBtn: { backgroundColor: '#E8A020', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 40 },
  webSubmitBtnDisabled: { backgroundColor: '#D1D5DB' },
  webSubmitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
