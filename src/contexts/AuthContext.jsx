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

  // Shared GIS initialization helper — prevents double-init via gsiInitialized ref.
  // Returns true if initialization was performed, false if skipped.
  const doInitGsi = useCallback((autoSelect = false) => {
    if (!window.google?.accounts?.id || gsiInitialized.current) return false;
    gsiInitialized.current = true;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: autoSelect,
      cancel_on_tap_outside: false,
    });
    setIsGsiReady(true);
    return true;
  }, [handleCredentialResponse]);

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
        // Reset the guard so doInitGsi will proceed
        gsiInitialized.current = false;
        doInitGsi(false);
      }
    }
  }, [doInitGsi]);

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
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed && typeof parsed === 'object' && typeof parsed.email === 'string') {
            setToken(storedToken);
            setUser(parsed);
          } else {
            throw new Error('Nieprawidłowa struktura danych użytkownika');
          }
        } catch {
          localStorage.removeItem('budget_auth_token');
          localStorage.removeItem('budget_auth_user');
        }
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

    const tryInit = () => {
      // Only auto-select / trigger One Tap for users with a valid (non-expired) stored token.
      // By this point the token-check effect has already cleared any expired token from
      // localStorage, so checking for expiry here is a belt-and-suspenders safety measure.
      const storedToken = localStorage.getItem('budget_auth_token');
      const hasValidToken = !!storedToken && !isTokenExpired(storedToken);

      if (!doInitGsi(hasValidToken)) return;

      // Prompt One Tap for returning users with a valid token
      if (hasValidToken) {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            if (import.meta.env.DEV) {
              console.warn(
                '[Auth] One Tap not shown:',
                notification.getNotDisplayedReason?.() || notification.getSkippedReason?.()
              );
            }
          }
        });
      }
    };

    if (window.google?.accounts?.id) {
      tryInit();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          clearTimeout(timeout);
          tryInit();
        }
      }, 100);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        // setIsLoading(false) is already called unconditionally by the token-check effect
        if (!gsiInitialized.current) {
          setGsiLoadFailed(true);
        }
      }, GIS_TIMEOUT_MS);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [doInitGsi]);

  // Retry GIS initialization (after network error)
  const retryGsiLoad = useCallback(() => {
    setGsiLoadFailed(false);
    gsiInitialized.current = false;

    if (window.google?.accounts?.id) {
      doInitGsi(false);
    } else {
      // Reload the GIS script dynamically.
      // gsiInitialized.current is already false (reset above); doInitGsi will set it
      // back to true once the script loads and window.google.accounts.id is available.
      const existing = document.querySelector('script[src*="accounts.google.com/gsi"]');
      if (existing) existing.remove();

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        const interval = setInterval(() => {
          if (window.google?.accounts?.id) {
            clearInterval(interval);
            doInitGsi(false);
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
  }, [doInitGsi]);

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
