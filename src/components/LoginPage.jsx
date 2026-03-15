import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import OfflineBanner from './OfflineBanner';

export default function LoginPage() {
  const { login, error, setError, isLoading } = useAuth();
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine);

  React.useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

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
              <p className="text-gray-500 mt-1">Zaloguj się, aby zarządzać finansami rodziny</p>
            </div>
          </div>

          {/* Offline banner */}
          {isOffline && (
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
                <button onClick={() => setError(null)} className="ml-2 font-medium hover:underline">
                  Zamknij
                </button>
              </div>
            </div>
          )}

          {/* Login button */}
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={login}
              disabled={isOffline}
              className="flex items-center gap-3 w-full justify-center px-6 py-3 rounded-2xl border border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 text-gray-700 font-medium text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* Google logo */}
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Zaloguj się przez Google
            </button>
            <p className="text-xs text-gray-400 text-center">
              Po zalogowaniu możesz stworzyć nową rodzinę<br />lub dołączyć do istniejącej kodem zaproszenia.
            </p>
          </div>

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
