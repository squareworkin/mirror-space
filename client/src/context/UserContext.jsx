import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { supabase } from '../lib/supabaseClient';

const UserContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Module-level (not per-render) so concurrent initUser() calls — e.g. React
// StrictMode's dev double-invoke of effects — share one in-flight sign-in instead
// of each racing signInAnonymously() and creating two separate anonymous
// identities. The old localId-based scheme didn't need this: identity was
// established synchronously before any await, so duplicate calls were naturally
// idempotent; signInAnonymously() has no equivalent idempotency key.
let signInPromise = null;

async function ensureSupabaseSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;

  if (!signInPromise) {
    signInPromise = supabase.auth.signInAnonymously().finally(() => {
      signInPromise = null;
    });
  }

  const { data, error } = await signInPromise;
  if (error) throw error;
  return data.session;
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Stable axios instance that updates auth header reactively
  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: API_URL,
    });

    // Add auth interceptor — always reads the current Supabase session, which
    // Supabase's client auto-refreshes under the hood when it's close to expiry.
    instance.interceptors.request.use(async (config) => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
      return config;
    });

    return instance;
  }, []);

  // Initialize user (Supabase anonymous auth)
  const initUser = useCallback(async () => {
    try {
      await ensureSupabaseSession();

      const { data } = await api.post('/auth/init');

      setUser(data.user);
    } catch (error) {
      console.error('Init error:', error);
      // Offline fallback — work with local data
      setUser({
        onboardingComplete: localStorage.getItem('mirrorspace_onboarding') === 'true',
        intents: JSON.parse(localStorage.getItem('mirrorspace_intents') || '[]'),
        permissions: JSON.parse(localStorage.getItem('mirrorspace_permissions') || '{}')
      });
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    initUser();
  }, [initUser]);

  // Save onboarding
  const completeOnboarding = async (intents, permissions) => {
    try {
      const { data } = await api.put('/user/onboarding', { intents, permissions });
      setUser(data);
      localStorage.setItem('mirrorspace_onboarding', 'true');
      localStorage.setItem('mirrorspace_intents', JSON.stringify(intents));
      localStorage.setItem('mirrorspace_permissions', JSON.stringify(permissions));
    } catch (error) {
      // Save locally if offline
      localStorage.setItem('mirrorspace_onboarding', 'true');
      localStorage.setItem('mirrorspace_intents', JSON.stringify(intents));
      localStorage.setItem('mirrorspace_permissions', JSON.stringify(permissions));
      setUser(prev => ({ ...prev, onboardingComplete: true, intents, permissions }));
    }
  };

  return (
    <UserContext.Provider value={{ user, loading, api, completeOnboarding }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within UserProvider');
  return context;
}
