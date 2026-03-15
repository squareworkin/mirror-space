import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';

const UserContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('mirrorspace_token'));
  const [loading, setLoading] = useState(true);

  // Stable axios instance that updates auth header reactively
  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: API_URL,
    });

    // Add auth interceptor
    instance.interceptors.request.use((config) => {
      const currentToken = localStorage.getItem('mirrorspace_token');
      if (currentToken) {
        config.headers.Authorization = `Bearer ${currentToken}`;
      }
      return config;
    });

    return instance;
  }, []);

  // Initialize user (local-first)
  const initUser = useCallback(async () => {
    try {
      let localId = localStorage.getItem('mirrorspace_local_id');
      
      if (!localId) {
        localId = crypto.randomUUID();
        localStorage.setItem('mirrorspace_local_id', localId);
      }

      const { data } = await api.post('/auth/init', { localId });
      
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('mirrorspace_token', data.token);
    } catch (error) {
      console.error('Init error:', error);
      // Offline fallback — work with local data
      setUser({
        localId: localStorage.getItem('mirrorspace_local_id'),
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
    <UserContext.Provider value={{ user, token, loading, api, completeOnboarding }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within UserProvider');
  return context;
}
