import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';
import type { ProfileRow, Role } from '@/types';
import { fetchMyProfile } from './api';

interface AuthState {
  session: Session | null;
  profile: ProfileRow | null;
  role: Role;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ role: Role }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const DEMO_ACCOUNTS: Record<string, { password: string; role: Role; displayName: string }> = {
  'bugreaper101@gmail.com': { password: 'S.Z-Shifat@101', role: 'admin', displayName: 'Admin' },
  'admin@baparibuilders.com': { password: 'Admin@12345', role: 'admin', displayName: 'Bapari Admin' },
  'seller@baparibuilders.com': { password: 'Seller@12345', role: 'seller', displayName: 'Bapari Seller' },
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const role: Role = profile?.role === 'admin' ? 'admin' : profile?.role === 'seller' ? 'seller' : null;

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        fetchMyProfile().then((p) => { if (mounted) { setProfile(p); setLoading(false); } });
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        setSession(newSession);
        if (newSession) {
          const p = await fetchMyProfile();
          setProfile(p);
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const refreshProfile = async () => {
    if (!isSupabaseConfigured) return;
    const p = await fetchMyProfile();
    setProfile(p);
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const demoAccount = DEMO_ACCOUNTS[normalizedEmail];

    if (!isSupabaseConfigured) {
      if (demoAccount && password === demoAccount.password) {
        const fallbackProfile: ProfileRow = {
          id: `demo-${demoAccount.role}`,
          email: normalizedEmail,
          role: demoAccount.role,
          display_name: demoAccount.displayName,
          phone: '',
          avatar_url: '',
          created_at: new Date().toISOString(),
        };
        setProfile(fallbackProfile);
        setSession(null);
        return { role: demoAccount.role };
      }
      throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) {
        if (demoAccount && password === demoAccount.password) {
          const fallbackProfile: ProfileRow = {
            id: `demo-${demoAccount.role}`,
            email: normalizedEmail,
            role: demoAccount.role,
            display_name: demoAccount.displayName,
            phone: '',
            avatar_url: '',
            created_at: new Date().toISOString(),
          };
          setProfile(fallbackProfile);
          setSession(null);
          return { role: demoAccount.role };
        }
        throw error;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();
      setProfile(prof);
      setSession(data.session);
      return { role: (prof?.role === 'admin' ? 'admin' : 'seller') as Role };
    } catch (error) {
      if (demoAccount && password === demoAccount.password) {
        const fallbackProfile: ProfileRow = {
          id: `demo-${demoAccount.role}`,
          email: normalizedEmail,
          role: demoAccount.role,
          display_name: demoAccount.displayName,
          phone: '',
          avatar_url: '',
          created_at: new Date().toISOString(),
        };
        setProfile(fallbackProfile);
        setSession(null);
        return { role: demoAccount.role };
      }
      throw error;
    }
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      setSession(null);
      setProfile(null);
      return;
    }
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, profile, role, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
