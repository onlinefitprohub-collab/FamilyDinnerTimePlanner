import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FreezerItem } from '../types';
import { supabase } from '../lib/supabase';
import {
  fetchFreezerItems,
  insertFreezerItem,
  updateFreezerItem as updateFreezerItemService,
  deleteFreezerItem,
} from '../services/supabaseService';

interface FreezerState {
  items: FreezerItem[];
  isLoading: boolean;
  addItem: (item: Omit<FreezerItem, 'id'>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  updateItem: (id: string, updates: Partial<FreezerItem>) => Promise<void>;
  syncFromSupabase: () => Promise<void>;
  subscribeToRealtime: (userId: string) => () => void;
}

export const useFreezerStore = create<FreezerState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,

      addItem: async (item: Omit<FreezerItem, 'id'>) => {
        try {
          const inserted = await insertFreezerItem(item);
          set((state) => ({ items: [...state.items, inserted] }));
        } catch (error) {
          console.error('[FreezerStore] addItem error:', error);
        }
      },

      removeItem: async (id: string) => {
        const previous = get().items;
        set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
        try {
          await deleteFreezerItem(id);
        } catch (error) {
          console.error('[FreezerStore] removeItem error:', error);
          set({ items: previous });
        }
      },

      updateItem: async (id: string, updates: Partial<FreezerItem>) => {
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        }));
        try {
          await updateFreezerItemService(id, updates);
        } catch (error) {
          console.error('[FreezerStore] updateItem error:', error);
        }
      },

      syncFromSupabase: async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

        set({ isLoading: true });
        try {
          const items = await fetchFreezerItems(userId);
          set({ items });
        } catch (error) {
          console.error('[FreezerStore] syncFromSupabase error:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      subscribeToRealtime: (userId: string) => {
        const channel = supabase
          .channel(`freezer_items:${userId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'freezer_items',
              filter: `user_id=eq.${userId}`,
            },
            async () => {
              try {
                const items = await fetchFreezerItems(userId);
                set({ items });
              } catch (error) {
                console.error('[FreezerStore] realtime sync error:', error);
              }
            },
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      },
    }),
    {
      name: 'freezer-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
