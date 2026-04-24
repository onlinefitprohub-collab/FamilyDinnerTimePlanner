import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PantryItem } from '../types';
import { supabase } from '../lib/supabase';
import {
  fetchPantryItems,
  upsertPantryItem,
  deletePantryItem,
} from '../services/supabaseService';

interface PantryState {
  items: PantryItem[];
  isLoading: boolean;
  toggleInStock: (ingredientId: string, quantity?: number) => Promise<void>;
  setLowStock: (ingredientId: string, isLow: boolean) => Promise<void>;
  addCustomItem: (ingredientId: string) => void;
  clearAll: () => Promise<void>;
  syncFromSupabase: () => Promise<void>;
  subscribeToRealtime: (userId: string) => () => void;
}

export const usePantryStore = create<PantryState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,

      toggleInStock: async (ingredientId: string, quantity?: number) => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

        const existing = get().items.find((i) => i.ingredientId === ingredientId);
        const updated: PantryItem = existing
          ? { ...existing, inStock: !existing.inStock, quantity: quantity ?? existing.quantity }
          : {
              id: `${userId}-${ingredientId}`,
              userId,
              ingredientId,
              inStock: true,
              quantity: quantity ?? 1,
              isLowStock: false,
            };

        set((state) => ({
          items: existing
            ? state.items.map((i) => (i.ingredientId === ingredientId ? updated : i))
            : [...state.items, updated],
        }));

        try {
          await upsertPantryItem(updated);
        } catch (error) {
          console.error('[PantryStore] toggleInStock error:', error);
        }
      },

      setLowStock: async (ingredientId: string, isLow: boolean) => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

        const existing = get().items.find((i) => i.ingredientId === ingredientId);
        if (!existing) return;

        const updated: PantryItem = { ...existing, isLowStock: isLow };
        set((state) => ({
          items: state.items.map((i) => (i.ingredientId === ingredientId ? updated : i)),
        }));

        try {
          await upsertPantryItem(updated);
        } catch (error) {
          console.error('[PantryStore] setLowStock error:', error);
        }
      },

      addCustomItem: (ingredientId: string) => {
        const existing = get().items.find((i) => i.ingredientId === ingredientId);
        if (existing) return;
        const newItem: PantryItem = {
          id: `local-${ingredientId}-${Date.now()}`,
          userId: '',
          ingredientId,
          inStock: true,
          quantity: 1,
          isLowStock: false,
        };
        set((state) => ({ items: [...state.items, newItem] }));
      },

      clearAll: async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

        const currentItems = [...get().items];
        set({ items: [] });

        try {
          await Promise.all(
            currentItems.map((item) => deletePantryItem(userId, item.ingredientId)),
          );
        } catch (error) {
          console.error('[PantryStore] clearAll error:', error);
          set({ items: currentItems });
        }
      },

      syncFromSupabase: async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

        set({ isLoading: true });
        try {
          const items = await fetchPantryItems(userId);
          set({ items });
        } catch (error) {
          console.error('[PantryStore] syncFromSupabase error:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      subscribeToRealtime: (userId: string) => {
        const channel = supabase
          .channel(`pantry_items:${userId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'pantry_items',
              filter: `user_id=eq.${userId}`,
            },
            async () => {
              try {
                const items = await fetchPantryItems(userId);
                set({ items });
              } catch (error) {
                console.error('[PantryStore] realtime sync error:', error);
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
      name: 'pantry-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
