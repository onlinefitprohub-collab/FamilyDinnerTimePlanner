import AsyncStorage from '@react-native-async-storage/async-storage';
import { BarcodeCacheEntry } from '../types';

const CACHE_KEY = '@barcode_cache';
const MAX_ENTRIES = 500;

type BarcodeCache = Record<string, BarcodeCacheEntry>;

async function readCache(): Promise<BarcodeCache> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as BarcodeCache;
  } catch (error) {
    console.error('[barcodeCache] readCache error:', error);
    return {};
  }
}

async function writeCache(cache: BarcodeCache): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('[barcodeCache] writeCache error:', error);
  }
}

export async function getCachedBarcode(barcode: string): Promise<BarcodeCacheEntry | null> {
  const cache = await readCache();
  return cache[barcode] ?? null;
}

export async function setCachedBarcode(entry: BarcodeCacheEntry): Promise<void> {
  const cache = await readCache();

  // Evict oldest entries if at capacity (excluding the one we're inserting)
  const existingKeys = Object.keys(cache).filter((k) => k !== entry.barcode);
  if (existingKeys.length >= MAX_ENTRIES) {
    // Sort by cachedAt ascending (oldest first) and remove excess
    const sorted = existingKeys.sort((a, b) => {
      const aTime = cache[a]?.cachedAt ?? '';
      const bTime = cache[b]?.cachedAt ?? '';
      return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
    });

    const toRemove = sorted.slice(0, existingKeys.length - MAX_ENTRIES + 1);
    for (const key of toRemove) {
      delete cache[key];
    }
  }

  cache[entry.barcode] = entry;
  await writeCache(cache);
}

export async function clearBarcodeCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error('[barcodeCache] clearBarcodeCache error:', error);
  }
}
