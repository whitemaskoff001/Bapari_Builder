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

const CACHE_KEY = 'bapari-session-v1';

type CachedSession = { profile: ProfileRow; savedAt: number };
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function readCache(): CachedSession | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSession;
    if (!parsed?.profile?.id || !parsed?.savedAt) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(profile: ProfileRow) {
  try {
    const payload: CachedSession = { profile, savedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Seed from the cache so the very first paint after a refresh already
  // shows the user as signed in — no logged-out flash.
  const initial = readCache();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(initial?.profile ?? null);
  const [loading, setLoading] = useState(!initial);

  const role: Role = profile?.role === 'admin' ? 'admin' : profile?.role === 'seller' ? 'seller' : null;

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Ask Supabase to restore / refresh the persisted session.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        fetchMyProfile()
          .then((p) => {
            if (!mounted) return;
            if (p) {
              setProfile(p);
              writeCache(p);
            } else if (initial?.profile) {
              setProfile(initial.profile);
            }
          })
          .catch(() => { /* keep cached profile on transient failure */ })
          .finally(() => { if (mounted) setLoading(false); });
      } else {
        // No live session — keep the cached profile so the user is not
        // immediately logged out on a refresh that races the token refresh.
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        setSession(newSession);
        if (newSession) {
          try {
            const p = await fetchMyProfile();
            if (p) {
              setProfile(p);
              writeCache(p);
            }
          } catch { /* ignore */ }
        } else {
          // Only clear the profile if the user actually signed out — a
          // transient null session (e.g. token refresh) should not log
          // them out, but a real sign-out must clear state.
          if (_event === 'SIGNED_OUT') {
            setProfile(null);
            clearCache();
          }
        }
        setLoading(false);
      })();
    });

    return () => { mounted = false; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshProfile = async () => {
    if (!isSupabaseConfigured) return;
    const p = await fetchMyProfile();
    if (p) {
      setProfile(p);
      writeCache(p);
    }
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
        writeCache(fallbackProfile);
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
          writeCache(fallbackProfile);
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
      const nextProfile = prof ?? {
        id: data.user.id,
        email: data.user.email ?? normalizedEmail,
        role: 'admin',
        display_name: demoAccount?.displayName || (data.user.email ?? 'Staff'),
        phone: '',
        avatar_url: '',
        created_at: new Date().toISOString(),
      } as ProfileRow;
      setProfile(nextProfile);
      writeCache(nextProfile);
      setSession(data.session);
      return { role: (nextProfile.role === 'admin' ? 'admin' : 'seller') as Role };
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
        writeCache(fallbackProfile);
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
      clearCache();
      return;
    }
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    clearCache();
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
