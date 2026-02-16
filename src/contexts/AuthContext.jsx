import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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
      localStorage.setItem('budget_auth_token', credential);
      localStorage.setItem('budget_auth_user', JSON.stringify(userData));
    } else {
      setError('Nie udało się zweryfikować danych logowania');
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('budget_auth_token');
    localStorage.removeItem('budget_auth_user');
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

  // Initialize: check for stored token
  useEffect(() => {
    const storedToken = localStorage.getItem('budget_auth_token');
    const storedUser = localStorage.getItem('budget_auth_user');

    if (storedToken && storedUser && !isTokenExpired(storedToken)) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    } else {
      // Clear expired data
      localStorage.removeItem('budget_auth_token');
      localStorage.removeItem('budget_auth_user');
    }

    setIsLoading(false);
  }, []);

  // Initialize Google Identity Services
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

    // GIS script might not be loaded yet
    if (window.google?.accounts?.id) {
      initGsi();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGsi();
        }
      }, 100);
      // Stop waiting after 10s
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
    isAuthenticated: !!user && !!token && !isTokenExpired(token),
    clientId: GOOGLE_CLIENT_ID,
    handleCredentialResponse,
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
