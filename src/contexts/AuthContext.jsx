import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const AuthContext = createContext(null);

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GIS_TIMEOUT_MS = 10000;

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
  const [isGsiReady, setIsGsiReady] = useState(false);
  const [gsiLoadFailed, setGsiLoadFailed] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const gsiInitialized = useRef(false);

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
      setError(null);
      setSessionExpired(false);
      localStorage.setItem('budget_auth_token', credential);
      localStorage.setItem('budget_auth_user', JSON.stringify(userData));
    } else {
      setError('Nie udało się zweryfikować danych logowania. Spróbuj ponownie.');
    }
  }, []);

  const logout = useCallback((reason = null) => {
    setUser(null);
    setToken(null);
    if (reason === 'expired') {
      setSessionExpired(true);
    }
    localStorage.removeItem('budget_auth_token');
    localStorage.removeItem('budget_auth_user');
    // Clear session storage cache as well
    sessionStorage.clear();
    // Re-initialize GIS so the login button works again
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
      if (GOOGLE_CLIENT_ID) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
        });
      }
    }
  }, [handleCredentialResponse]);

  // Listen for session-expired events from API layer
  useEffect(() => {
    const handleSessionExpired = () => logout('expired');
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, [logout]);

  // Initialize: check for stored token
  useEffect(() => {
    const storedToken = localStorage.getItem('budget_auth_token');
    const storedUser = localStorage.getItem('budget_auth_user');

    if (storedToken && storedUser) {
      if (!isTokenExpired(storedToken)) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } else {
        // Token expired — show friendly message
        localStorage.removeItem('budget_auth_token');
        localStorage.removeItem('budget_auth_user');
        setSessionExpired(true);
      }
    }

    setIsLoading(false);
  }, []);

  // Initialize Google Identity Services
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const initGsi = () => {
      if (!window.google?.accounts?.id || gsiInitialized.current) return;
      gsiInitialized.current = true;

      const hasStoredToken = !!localStorage.getItem('budget_auth_token');

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        // Enable One Tap for returning users
        auto_select: hasStoredToken,
        cancel_on_tap_outside: false,
      });

      setIsGsiReady(true);

      // Prompt One Tap for returning users
      if (hasStoredToken) {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // One Tap not shown — user will use button
          }
        });
      }
    };

    if (window.google?.accounts?.id) {
      initGsi();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          clearTimeout(timeout);
          initGsi();
        }
      }, 100);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        if (!gsiInitialized.current) {
          setGsiLoadFailed(true);
          setIsLoading(false);
        }
      }, GIS_TIMEOUT_MS);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [handleCredentialResponse]);

  // Retry GIS initialization (after network error)
  const retryGsiLoad = useCallback(() => {
    setGsiLoadFailed(false);
    gsiInitialized.current = false;

    if (window.google?.accounts?.id) {
      const initGsi = () => {
        if (!window.google?.accounts?.id || gsiInitialized.current) return;
        gsiInitialized.current = true;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: false,
        });
        setIsGsiReady(true);
      };
      initGsi();
    } else {
      // Reload the GIS script
      const existing = document.querySelector('script[src*="accounts.google.com/gsi"]');
      if (existing) existing.remove();

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        gsiInitialized.current = false;
        const interval = setInterval(() => {
          if (window.google?.accounts?.id) {
            clearInterval(interval);
            gsiInitialized.current = true;
            window.google.accounts.id.initialize({
              client_id: GOOGLE_CLIENT_ID,
              callback: handleCredentialResponse,
              auto_select: false,
              cancel_on_tap_outside: false,
            });
            setIsGsiReady(true);
          }
        }, 100);
        setTimeout(() => {
          clearInterval(interval);
          if (!gsiInitialized.current) setGsiLoadFailed(true);
        }, GIS_TIMEOUT_MS);
      };
      script.onerror = () => setGsiLoadFailed(true);
      document.head.appendChild(script);
    }
  }, [handleCredentialResponse]);

  const value = {
    user,
    token,
    isLoading,
    error,
    setError,
    logout,
    isAuthenticated: !!user && !!token && !isTokenExpired(token),
    clientId: GOOGLE_CLIENT_ID,
    handleCredentialResponse,
    isGsiReady,
    gsiLoadFailed,
    sessionExpired,
    retryGsiLoad,
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
