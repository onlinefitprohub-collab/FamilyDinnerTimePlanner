import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScanHistoryEntry } from '../types';
import { supabase } from '../lib/supabase';
import {
  fetchScanHistory,
  insertScanEntry,
  deleteScanHistory,
} from '../services/supabaseService';

const MAX_LOCAL_ENTRIES = 50;

interface ScanState {
  history: ScanHistoryEntry[];
  isLoading: boolean;
  addScan: (entry: Omit<ScanHistoryEntry, 'id'>) => Promise<void>;
  clearHistory: () => Promise<void>;
  syncFromSupabase: (userId: string) => Promise<void>;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useScanStore = create<ScanState>()(
  persist(
    (set, get) => ({
      history: [],
      isLoading: false,

      addScan: async (entry: Omit<ScanHistoryEntry, 'id'>) => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

        const full: ScanHistoryEntry = {
          ...entry,
          id: generateId(),
          userId,
        };

        // Add to front of list and trim to MAX_LOCAL_ENTRIES
        set((state) => {
          const updated = [full, ...state.history];
          const trimmed = updated.slice(0, MAX_LOCAL_ENTRIES);
          return { history: trimmed };
        });

        try {
          await insertScanEntry(full);
        } catch (error) {
          console.error('[ScanStore] addScan error:', error);
          // Remove the optimistically added entry on failure
          set((state) => ({
            history: state.history.filter((h) => h.id !== full.id),
          }));
        }
      },

      clearHistory: async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;

        const previous = get().history;
        set({ history: [] });

        if (!userId) return;

        try {
          await deleteScanHistory(userId);
        } catch (error) {
          console.error('[ScanStore] clearHistory error:', error);
          set({ history: previous });
        }
      },

      syncFromSupabase: async (userId: string) => {
        set({ isLoading: true });
        try {
          const entries = await fetchScanHistory(userId);
          // Supabase already limits to 50 via fetchScanHistory
          set({ history: entries.slice(0, MAX_LOCAL_ENTRIES) });
        } catch (error) {
          console.error('[ScanStore] syncFromSupabase error:', error);
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'scan-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
