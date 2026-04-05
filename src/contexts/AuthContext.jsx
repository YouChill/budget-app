import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    // Pobierz aktywną sesję przy starcie
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Nasłuchuj zmian stanu autentykacji (login, logout, refresh tokenu)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);

      if (event === 'SIGNED_OUT') {
        setSessionExpired(false);
        sessionStorage.clear();
      }
      if (event === 'TOKEN_REFRESHED') {
        setSessionExpired(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Logowanie przez Google OAuth — przekierowanie do strony Google.
   * Po pomyślnym zalogowaniu Supabase przekieruje z powrotem na VITE_SUPABASE_REDIRECT_URL.
   */
  const loginWithGoogle = useCallback(async () => {
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: import.meta.env.VITE_SUPABASE_REDIRECT_URL || window.location.origin,
      },
    });
    if (oauthError) setError(oauthError.message);
  }, []);

  /**
   * Logowanie email + hasło.
   * Zwraca true przy sukcesie, false przy błędzie (błąd zapisany w state.error).
   */
  const loginWithEmail = useCallback(async (email, password) => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      return false;
    }
    return true;
  }, []);

  /**
   * Rejestracja nowego konta email + hasło.
   * Supabase może wymagać potwierdzenia emaila (zależnie od konfiguracji projektu).
   * Zwraca { success, needsConfirmation }.
   */
  const signUp = useCallback(async (email, password) => {
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: import.meta.env.VITE_SUPABASE_REDIRECT_URL || window.location.origin,
      },
    });
    if (signUpError) {
      setError(signUpError.message);
      return { success: false, needsConfirmation: false };
    }
    // Jeśli identities jest puste — email już istnieje (Supabase zwraca fałszywy sukces)
    const needsConfirmation = !data.session && !!data.user;
    return { success: true, needsConfirmation };
  }, []);

  /**
   * Wylogowanie — czyści sesję Supabase i cache sessionStorage.
   */
  const logout = useCallback(async () => {
    sessionStorage.clear();
    await supabase.auth.signOut();
  }, []);

  /**
   * Resetowanie hasła — wysyła email z linkiem do resetu.
   */
  const resetPassword = useCallback(async (email) => {
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: import.meta.env.VITE_SUPABASE_REDIRECT_URL || window.location.origin,
    });
    if (resetError) {
      setError(resetError.message);
      return false;
    }
    return true;
  }, []);

  const value = {
    user,
    isLoading,
    error,
    setError,
    isAuthenticated: !!user,
    sessionExpired,
    loginWithGoogle,
    loginWithEmail,
    signUp,
    logout,
    resetPassword,
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
