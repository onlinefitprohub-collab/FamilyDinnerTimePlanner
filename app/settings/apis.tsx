import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theMealDBService } from '../../src/services/recipeApi';

type Provider = 'themealdb' | 'spoonacular' | 'edamam';

const PROVIDERS: { id: Provider; label: string; subtitle: string }[] = [
  { id: 'themealdb', label: 'TheMealDB', subtitle: 'Free — no API key required' },
  { id: 'spoonacular', label: 'Spoonacular', subtitle: 'Requires API key · Nutritional data included' },
  { id: 'edamam', label: 'Edamam', subtitle: 'Requires API key · Diet/allergy filters included' },
];

const FEATURES = [
  { feature: 'Recipe search', themealdb: true, spoonacular: true, edamam: true },
  { feature: 'Browse by category', themealdb: true, spoonacular: true, edamam: true },
  { feature: 'Nutritional data', themealdb: false, spoonacular: true, edamam: true },
  { feature: 'Diet & allergy filters', themealdb: false, spoonacular: true, edamam: true },
  { feature: 'Search by ingredients', themealdb: false, spoonacular: true, edamam: false },
  { feature: 'API key required', themealdb: false, spoonacular: true, edamam: true },
];

export default function ApisScreen() {
  const [provider, setProvider] = useState<Provider>('themealdb');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@recipe_provider').then((v) => {
      if (v) setProvider(v as Provider);
    });
  }, []);

  const selectProvider = async (p: Provider) => {
    setProvider(p);
    setTestResult(null);
    await AsyncStorage.setItem('@recipe_provider', p);
    if (p !== 'themealdb') {
      const stored = await SecureStore.getItemAsync(`@recipe_api_key_${p}`);
      setApiKey(stored ?? '');
    }
  };

  const saveKey = async () => {
    await SecureStore.setItemAsync(`@recipe_api_key_${provider}`, apiKey);
    Alert.alert('Saved', 'API key stored securely on this device.');
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const ok = await theMealDBService.testConnection();
      setTestResult(ok ? '✓ Connection successful' : '✗ Connection failed');
    } catch {
      setTestResult('✗ Connection failed');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Recipe APIs', headerStyle: { backgroundColor: '#FAFAF8' }, headerTitleStyle: { color: '#1A2B4A' } }} />
      <ScrollView style={styles.container}>
        <Text style={styles.sectionTitle}>RECIPE PROVIDER</Text>
        <View style={styles.card}>
          {PROVIDERS.map((p, i) => (
            <Pressable key={p.id} style={[styles.providerRow, i < PROVIDERS.length - 1 && styles.rowBorder]} onPress={() => selectProvider(p.id)}>
              <View style={styles.providerInfo}>
                <Text style={styles.providerLabel}>{p.label}</Text>
                <Text style={styles.providerSubtitle}>{p.subtitle}</Text>
              </View>
              {provider === p.id && <Ionicons name="checkmark-circle" size={22} color="#E8A020" />}
            </Pressable>
          ))}
        </View>

        {provider !== 'themealdb' && (
          <>
            <Text style={styles.sectionTitle}>API KEY</Text>
            <View style={styles.card}>
              <View style={styles.keyRow}>
                <TextInput
                  style={styles.keyInput}
                  value={apiKey}
                  onChangeText={setApiKey}
                  secureTextEntry={!showKey}
                  placeholder="Paste your API key here"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setShowKey((v) => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showKey ? 'eye-off' : 'eye'} size={20} color="#6B7280" />
                </Pressable>
              </View>
              <Pressable style={styles.saveBtn} onPress={saveKey}>
                <Text style={styles.saveBtnText}>Save Key</Text>
              </Pressable>
              <Pressable style={styles.testBtn} onPress={testConnection} disabled={isTesting}>
                {isTesting ? <ActivityIndicator color="#1A2B4A" /> : <Text style={styles.testBtnText}>Test Connection</Text>}
              </Pressable>
              {testResult && <Text style={[styles.testResult, testResult.startsWith('✓') ? styles.testOk : styles.testFail]}>{testResult}</Text>}
              <Text style={styles.secureNote}>🔒 Your API key is stored securely on this device only. It is never sent to our servers.</Text>
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>FEATURE COMPARISON</Text>
        <View style={styles.card}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, styles.tableFeatureCell]} />
            <Text style={styles.tableHeaderCell}>TheMealDB</Text>
            <Text style={styles.tableHeaderCell}>Spoonacular</Text>
            <Text style={styles.tableHeaderCell}>Edamam</Text>
          </View>
          {FEATURES.map((row, i) => (
            <View key={row.feature} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
              <Text style={[styles.tableCell, styles.tableFeatureCell]}>{row.feature}</Text>
              <Text style={styles.tableCell}>{row.themealdb ? '✓' : '✗'}</Text>
              <Text style={styles.tableCell}>{row.spoonacular ? '✓' : '✗'}</Text>
              <Text style={styles.tableCell}>{row.edamam ? '✓' : '✗'}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 24, marginBottom: 8, paddingHorizontal: 16 },
  card: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, overflow: 'hidden' },
  providerRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  providerInfo: { flex: 1 },
  providerLabel: { fontSize: 15, fontWeight: '600', color: '#1A2B4A' },
  providerSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  keyRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  keyInput: { flex: 1, padding: 16, fontSize: 14, color: '#1A2B4A' },
  eyeBtn: { padding: 16 },
  saveBtn: { margin: 12, backgroundColor: '#1A2B4A', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  testBtn: { marginHorizontal: 12, marginBottom: 12, backgroundColor: '#F3F4F6', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  testBtnText: { color: '#1A2B4A', fontWeight: '600' },
  testResult: { marginHorizontal: 12, marginBottom: 8, fontWeight: '600', textAlign: 'center' },
  testOk: { color: '#8FAF7E' },
  testFail: { color: '#C0392B' },
  secureNote: { fontSize: 12, color: '#6B7280', margin: 12, lineHeight: 17 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F9FAFB', paddingVertical: 10 },
  tableHeaderCell: { flex: 1, fontSize: 11, fontWeight: '700', color: '#6B7280', textAlign: 'center' },
  tableRow: { flexDirection: 'row', paddingVertical: 10 },
  tableRowAlt: { backgroundColor: '#FAFAF8' },
  tableCell: { flex: 1, fontSize: 12, color: '#374151', textAlign: 'center' },
  tableFeatureCell: { flex: 2, textAlign: 'left', paddingLeft: 12, fontWeight: '500', color: '#1A2B4A' },
});
