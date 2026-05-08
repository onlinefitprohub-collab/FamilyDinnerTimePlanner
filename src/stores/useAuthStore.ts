import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { UserProfile } from '../types';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  familySize: number;
  isLoading: boolean;
  onboardingComplete: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setFamilySize: (size: number) => void;
  setOnboardingComplete: (v: boolean) => void;
  signOut: () => Promise<void>;
  syncFromSupabase: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      user: null,
      profile: null,
      familySize: 4,
      isLoading: false,
      onboardingComplete: false,

      setOnboardingComplete: (v: boolean) => set({ onboardingComplete: v }),

      setSession: (session: Session | null) => {
        set({ session, user: session?.user ?? null });
      },

      setProfile: (profile: UserProfile | null) => {
        set({ profile, familySize: profile?.familySize ?? get().familySize });
      },

      setFamilySize: (size: number) => {
        set({ familySize: size });
      },

      signOut: async () => {
        try {
          await supabase.auth.signOut();
        } catch (error) {
          console.error('[AuthStore] signOut error:', error);
        }
        set({
          session: null,
          user: null,
          profile: null,
          familySize: 4,
          isLoading: false,
        });
      },

      syncFromSupabase: async () => {
        set({ isLoading: true });
        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) {
            console.error('[AuthStore] getSession error:', sessionError);
            return;
          }

          const session = sessionData.session;
          const user = session?.user ?? null;
          set({ session, user });

          if (!user) return;

          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('user_id, family_name, family_size')
            .eq('user_id', user.id)
            .maybeSingle();

          if (profileError) {
            console.error('[AuthStore] fetchProfile error:', profileError);
            return;
          }

          if (profileData) {
            const profile: UserProfile = {
              userId: profileData.user_id as string,
              familyName: profileData.family_name as string,
              familySize: profileData.family_size as number,
            };
            set({ profile, familySize: profile.familySize });
          }
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        profile: state.profile,
        familySize: state.familySize,
        // onboardingComplete intentionally excluded — sourced from AsyncStorage
      }),
    },
  ),
);
