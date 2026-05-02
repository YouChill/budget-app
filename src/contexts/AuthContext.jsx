import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

function translateAuthError(err) {
  if (!err) return null;
  const msg = err.message || '';
  if (/invalid login credentials/i.test(msg)) return 'Nieprawidłowy email lub hasło.';
  if (/email not confirmed/i.test(msg)) return 'Email nie został potwierdzony. Sprawdź skrzynkę.';
  if (/user already registered/i.test(msg)) return 'Użytkownik z tym emailem już istnieje.';
  if (/password should be at least/i.test(msg)) return 'Hasło musi mieć co najmniej 8 znaków.';
  if (/rate limit/i.test(msg)) return 'Zbyt wiele prób. Spróbuj ponownie za chwilę.';
  return msg || 'Wystąpił błąd logowania.';
}

function normalizeUser(supabaseUser) {
  if (!supabaseUser) return null;
  const meta = supabaseUser.user_metadata || {};
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    name: meta.display_name || meta.name || supabaseUser.email,
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [infoMessage, setInfoMessage] = useState(null);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);

  useEffect(() => {
    // Supabase puts the recovery token in the URL hash; detect it before the
    // initial getSession() so we can gate the UI on a "set new password" form
    // instead of dropping the user straight into the app.
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setIsRecoveringPassword(true);
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveringPassword(true);
        setError(null);
        setSessionExpired(false);
      } else if (event === 'SIGNED_IN') {
        setError(null);
        setSessionExpired(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email, password) => {
    setError(null);
    setInfoMessage(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(translateAuthError(err));
      return false;
    }
    return true;
  }, []);

  const signUp = useCallback(async (email, password, displayName) => {
    setError(null);
    setInfoMessage(null);
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split('@')[0] },
        emailRedirectTo: window.location.origin,
      },
    });
    if (err) {
      setError(translateAuthError(err));
      return false;
    }
    // Jeśli email confirmation jest włączony, session będzie null — user musi kliknąć link.
    if (!data.session) {
      setInfoMessage('Sprawdź swoją skrzynkę email, aby potwierdzić rejestrację.');
    }
    return true;
  }, []);

  const resetPassword = useCallback(async (email) => {
    setError(null);
    setInfoMessage(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}`,
    });
    if (err) {
      setError(translateAuthError(err));
      return false;
    }
    setInfoMessage('Jeśli konto istnieje, wysłaliśmy link do resetu hasła.');
    return true;
  }, []);

  const updatePassword = useCallback(async (newPassword) => {
    setError(null);
    setInfoMessage(null);
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    if (err) {
      setError(translateAuthError(err));
      return false;
    }
    setIsRecoveringPassword(false);
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setInfoMessage('Hasło zostało zmienione.');
    return true;
  }, []);

  const cancelPasswordRecovery = useCallback(async () => {
    setIsRecoveringPassword(false);
    setError(null);
    setInfoMessage(null);
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    await supabase.auth.signOut();
  }, []);

  const logout = useCallback(async (reason = null) => {
    if (reason === 'expired') setSessionExpired(true);
    await supabase.auth.signOut();
    sessionStorage.clear();
  }, []);

  useEffect(() => {
    const handler = () => logout('expired');
    window.addEventListener('auth:session-expired', handler);
    return () => window.removeEventListener('auth:session-expired', handler);
  }, [logout]);

  const user = useMemo(() => normalizeUser(session?.user), [session]);

  const value = {
    user,
    isAuthenticated: !!session,
    isLoading,
    error,
    setError,
    infoMessage,
    setInfoMessage,
    sessionExpired,
    isRecoveringPassword,
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    cancelPasswordRecovery,
    logout,
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
