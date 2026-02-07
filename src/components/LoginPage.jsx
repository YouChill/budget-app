import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { error, setError, clientId, isLoading } = useAuth();
  const buttonRef = useRef(null);
  const rendered = useRef(false);

  useEffect(() => {
    if (!clientId || rendered.current) return;

    const renderButton = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) return;

      rendered.current = true;
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        logo_alignment: 'left',
        width: 300,
      });
    };

    if (window.google?.accounts?.id) {
      renderButton();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          renderButton();
        }
      }, 100);
      setTimeout(() => clearInterval(interval), 10000);
      return () => clearInterval(interval);
    }
  }, [clientId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-indigo-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
          <span>Ładowanie...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-white shadow-2xl p-8 space-y-8">
          {/* Logo and title */}
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Budżet Domowy</h1>
              <p className="text-gray-500 mt-1">Zaloguj się, aby zarządzać finansami</p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-2 font-medium hover:underline"
              >
                Zamknij
              </button>
            </div>
          )}

          {/* Google Sign-In button */}
          {clientId ? (
            <div className="flex flex-col items-center gap-4">
              <div ref={buttonRef}></div>
              <p className="text-xs text-gray-400 text-center">
                Logowanie za pomocą konta Google
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              <p className="font-medium mb-1">Brak konfiguracji Google OAuth</p>
              <p>
                Ustaw zmienną <code className="bg-amber-100 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> w pliku <code className="bg-amber-100 px-1 rounded">.env</code>
              </p>
            </div>
          )}

          {/* Footer info */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400 text-center">
              Dostęp tylko dla autoryzowanych użytkowników.
              <br />
              Dane są przechowywane w Google Sheets.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
