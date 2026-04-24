import { useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

export function useAuth() {
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const familySize = useAuthStore((s) => s.familySize);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setSession = useAuthStore((s) => s.setSession);
  const signOut = useAuthStore((s) => s.signOut);
  const syncFromSupabase = useAuthStore((s) => s.syncFromSupabase);

  useEffect(() => {
    // Check existing session and load profile on mount
    syncFromSupabase();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, newSession: Session | null) => {
        setSession(newSession);

        if (newSession?.user) {
          // Re-sync profile whenever auth state changes
          syncFromSupabase();
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { session, user, profile, familySize, isLoading, signOut };
}
