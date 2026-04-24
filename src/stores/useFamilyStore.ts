import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FamilyMember } from '../types';
import { supabase } from '../lib/supabase';
import {
  fetchFamilyMembers,
  upsertFamilyMember,
  deleteFamilyMember as deleteFamilyMemberService,
} from '../services/supabaseService';

interface FamilyState {
  members: FamilyMember[];
  isLoading: boolean;
  addMember: (member: Omit<FamilyMember, 'id'>) => Promise<void>;
  updateMember: (id: string, updates: Partial<FamilyMember>) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  syncFromSupabase: () => Promise<void>;
  subscribeToRealtime: (userId: string) => () => void;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useFamilyStore = create<FamilyState>()(
  persist(
    (set, get) => ({
      members: [],
      isLoading: false,

      addMember: async (member: Omit<FamilyMember, 'id'>) => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

        const full: FamilyMember = {
          ...member,
          id: generateId(),
          userId,
        };

        set((state) => ({ members: [...state.members, full] }));

        try {
          await upsertFamilyMember(full);
        } catch (error) {
          console.error('[FamilyStore] addMember error:', error);
          set((state) => ({
            members: state.members.filter((m) => m.id !== full.id),
          }));
        }
      },

      updateMember: async (id: string, updates: Partial<FamilyMember>) => {
        const previous = get().members;
        set((state) => ({
          members: state.members.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        }));

        try {
          const updated = get().members.find((m) => m.id === id);
          if (updated) {
            await upsertFamilyMember(updated);
          }
        } catch (error) {
          console.error('[FamilyStore] updateMember error:', error);
          set({ members: previous });
        }
      },

      removeMember: async (id: string) => {
        const previous = get().members;
        set((state) => ({ members: state.members.filter((m) => m.id !== id) }));

        try {
          await deleteFamilyMemberService(id);
        } catch (error) {
          console.error('[FamilyStore] removeMember error:', error);
          set({ members: previous });
        }
      },

      syncFromSupabase: async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;

        set({ isLoading: true });
        try {
          const members = await fetchFamilyMembers(userId);
          set({ members });
        } catch (error) {
          console.error('[FamilyStore] syncFromSupabase error:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      subscribeToRealtime: (userId: string) => {
        const channel = supabase
          .channel(`family_members:${userId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'family_members',
              filter: `user_id=eq.${userId}`,
            },
            async () => {
              try {
                const members = await fetchFamilyMembers(userId);
                set({ members });
              } catch (error) {
                console.error('[FamilyStore] realtime sync error:', error);
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
      name: 'family-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
