import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Decode JWT payload without external libraries
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function isTokenExpired(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return true;
  // Add 60s buffer before actual expiration
  return Date.now() >= (payload.exp - 60) * 1000;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  // Track auth source so logout works correctly
  const [authSource, setAuthSource] = useState(null); // 'google' | 'supabase'

  // Ref to avoid stale closures in onAuthStateChange callback
  // and to prevent unnecessary listener re-subscriptions
  const authSourceRef = useRef(null);

  // === GOOGLE GIS HANDLER (existing flow) ===
  const handleCredentialResponse = useCallback((response) => {
    const credential = response.credential;
    const payload = decodeJwtPayload(credential);

    if (payload) {
      const userData = {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      };
      setUser(userData);
      setToken(credential);
      setAuthSource('google');
      authSourceRef.current = 'google';
      setError(null);
      localStorage.setItem('budget_auth_token', credential);
      localStorage.setItem('budget_auth_user', JSON.stringify(userData));
      localStorage.setItem('budget_auth_source', 'google');
    } else {
      setError('Nie udało się zweryfikować danych logowania');
    }
  }, []);

  // === SUPABASE SESSION HANDLER (for email/password demo login) ===
  const handleSupabaseSession = useCallback((session) => {
    if (session?.user) {
      const supaUser = session.user;
      const userData = {
        email: supaUser.email,
        name: supaUser.user_metadata?.name || supaUser.user_metadata?.display_name || supaUser.email,
        picture: supaUser.user_metadata?.avatar_url || null,
      };
      setUser(userData);
      setToken(session.access_token);
      setAuthSource('supabase');
      authSourceRef.current = 'supabase';
      setError(null);
      localStorage.setItem('budget_auth_token', session.access_token);
      localStorage.setItem('budget_auth_user', JSON.stringify(userData));
      localStorage.setItem('budget_auth_source', 'supabase');
    }
  }, []);

  // === LOGOUT ===
  const logout = useCallback(async () => {
    // If logged in via Supabase, sign out from Supabase too
    if (authSourceRef.current === 'supabase') {
      await supabase.auth.signOut();
    }

    setUser(null);
    setToken(null);
    setAuthSource(null);
    authSourceRef.current = null;
    localStorage.removeItem('budget_auth_token');
    localStorage.removeItem('budget_auth_user');
    localStorage.removeItem('budget_auth_source');
    // Clear session storage cache as well
    sessionStorage.clear();
    // Re-initialize GIS so the login button works again
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
      });
    }
  }, [handleCredentialResponse]);

  // === SUPABASE AUTH LISTENER ===
  // Single stable subscription — uses authSourceRef to avoid stale closures
  // and unnecessary re-subscriptions when authSource state changes.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
          handleSupabaseSession(session);
          setIsLoading(false);
        } else if (event === 'INITIAL_SESSION' && !session) {
          // No Supabase session — if we were expecting one, clean up
          const storedSource = localStorage.getItem('budget_auth_source');
          if (storedSource === 'supabase') {
            localStorage.removeItem('budget_auth_token');
            localStorage.removeItem('budget_auth_user');
            localStorage.removeItem('budget_auth_source');
          }
          // Only set loading false if not waiting for Google auth
          if (!storedSource || storedSource === 'supabase') {
            setIsLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
          // Only clear if we were using Supabase auth
          if (authSourceRef.current === 'supabase') {
            setUser(null);
            setToken(null);
            setAuthSource(null);
            authSourceRef.current = null;
            localStorage.removeItem('budget_auth_token');
            localStorage.removeItem('budget_auth_user');
            localStorage.removeItem('budget_auth_source');
          }
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // Update token on refresh
          if (authSourceRef.current === 'supabase') {
            setToken(session.access_token);
            localStorage.setItem('budget_auth_token', session.access_token);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [handleSupabaseSession]);

  // === INIT: Restore Google session (Supabase handled by INITIAL_SESSION above) ===
  useEffect(() => {
    const storedSource = localStorage.getItem('budget_auth_source');

    if (storedSource === 'google') {
      // Restore Google GIS session
      const storedToken = localStorage.getItem('budget_auth_token');
      const storedUser = localStorage.getItem('budget_auth_user');

      if (storedToken && storedUser && !isTokenExpired(storedToken)) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setAuthSource('google');
        authSourceRef.current = 'google';
      } else {
        localStorage.removeItem('budget_auth_token');
        localStorage.removeItem('budget_auth_user');
        localStorage.removeItem('budget_auth_source');
      }
      setIsLoading(false);
    }
    // For 'supabase' source: onAuthStateChange INITIAL_SESSION handles restoration
    // For no stored source: onAuthStateChange INITIAL_SESSION with null session sets loading false
  }, []);

  // === GOOGLE GIS INITIALIZATION (existing logic) ===
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const initGsi = () => {
      if (!window.google?.accounts?.id) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: !!localStorage.getItem('budget_auth_token'),
      });
    };

    if (window.google?.accounts?.id) {
      initGsi();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGsi();
        }
      }, 100);
      setTimeout(() => clearInterval(interval), 10000);
    }
  }, [handleCredentialResponse]);

  const value = {
    user,
    token,
    isLoading,
    error,
    setError,
    logout,
    isAuthenticated: !!user && !!token && (
      authSource === 'supabase' || !isTokenExpired(token)
    ),
    clientId: GOOGLE_CLIENT_ID,
    handleCredentialResponse,
    authSource,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
