import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800 flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23"></line>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9"></path>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
        <line x1="12" y1="20" x2="12.01" y2="20"></line>
      </svg>
      Brak połączenia z internetem. Sprawdź sieć i spróbuj ponownie.
    </div>
  );
}

export default function LoginPage() {
  const { error, setError, clientId, isLoading, isGsiReady, gsiLoadFailed, sessionExpired, retryGsiLoad } = useAuth();
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!clientId || !isGsiReady || !buttonRef.current) return;

    if (!window.google?.accounts?.id) return;

    buttonRef.current.replaceChildren();
    window.google.accounts.id.renderButton(buttonRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'pill',
      logo_alignment: 'left',
      width: 300,
    });
  }, [clientId, isGsiReady]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-indigo-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
          <span className="text-sm">Ładowanie aplikacji...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-white shadow-2xl p-8 space-y-6">
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

          {/* Offline banner */}
          <OfflineBanner />

          {/* Session expired message */}
          {sessionExpired && !error && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
              <svg className="mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>Twoja sesja wygasła. Zaloguj się ponownie, aby kontynuować.</span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 flex items-start gap-2">
              <svg className="mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <div className="flex-1">
                {error}
                <button
                  onClick={() => setError(null)}
                  className="ml-2 font-medium hover:underline"
                >
                  Zamknij
                </button>
              </div>
            </div>
          )}

          {/* Login area */}
          {clientId ? (
            <div className="flex flex-col items-center gap-4">
              {gsiLoadFailed ? (
                /* GIS failed to load */
                <div className="flex flex-col items-center gap-3 w-full">
                  <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 text-center w-full">
                    <p className="font-medium mb-1">Nie można załadować logowania Google</p>
                    <p className="text-rose-600">Sprawdź połączenie z internetem lub odblokuj google.com w ustawieniach sieci.</p>
                  </div>
                  <button
                    onClick={retryGsiLoad}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                    Spróbuj ponownie
                  </button>
                </div>
              ) : !isGsiReady ? (
                /* GIS still loading */
                <div className="flex flex-col items-center gap-2 py-2">
                  <svg className="animate-spin text-indigo-400" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                  </svg>
                  <span className="text-xs text-gray-400">Ładowanie logowania Google...</span>
                </div>
              ) : (
                /* GIS ready — show button */
                <div ref={buttonRef} style={{ minHeight: 44 }}></div>
              )}

              {isGsiReady && !gsiLoadFailed && (
                <p className="text-xs text-gray-400 text-center">
                  Logowanie za pomocą konta Google
                </p>
              )}
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
              Dane są przechowywane w Supabase PostgreSQL.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
