import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import supabase from '../lib/supabase';
import { apiFetch } from '../lib/api';

export interface Profile {
  id: string;
  auth_user_id?: string;
  email?: string;
  phone?: string;
  full_name: string;
  company_name?: string;
  role: string;
  status?: string;
  kyc_status?: string;
  city?: string;
  region?: string;
  avatar_url?: string;
  rating_avg?: number;
  rating_count?: number;
  total_transactions?: number;
  created_at?: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  token: string | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  profile: null,
  token: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (sess: Session | null) => {
    if (!sess) {
      setProfile(null);
      return;
    }
    try {
      const p = await apiFetch<Profile>('/api/profiles', { token: sess.access_token });
      setProfile(p);
    } catch (err) {
      console.error('Failed to load profile', err);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      if (!mounted) return;
      setSession(sess);
      await loadProfile(sess);
      if (mounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      loadProfile(sess);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await loadProfile(data.session);
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      token: session?.access_token ?? null,
      loading,
      refreshProfile,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
