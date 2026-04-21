import React, { useEffect, useState } from 'react';
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

const MODES = {
  SIGNIN: 'signin',
  SIGNUP: 'signup',
  RESET: 'reset',
};

export default function LoginPage() {
  const {
    isLoading, error, setError, infoMessage, setInfoMessage, sessionExpired,
    signIn, signUp, resetPassword,
  } = useAuth();

  const [mode, setMode] = useState(MODES.SIGNIN);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (newMode) => {
    setMode(newMode);
    setError(null);
    setInfoMessage(null);
    setPassword('');
    setPasswordConfirm('');
  };

  const validate = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Nieprawidłowy adres email.');
      return false;
    }
    if (mode === MODES.RESET) return true;
    if (password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków.');
      return false;
    }
    if (mode === MODES.SIGNUP && password !== passwordConfirm) {
      setError('Hasła nie są identyczne.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (mode === MODES.SIGNIN) await signIn(email, password);
      else if (mode === MODES.SIGNUP) await signUp(email, password, displayName);
      else if (mode === MODES.RESET) await resetPassword(email);
    } finally {
      setSubmitting(false);
    }
  };

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

  const submitLabel = {
    [MODES.SIGNIN]: 'Zaloguj się',
    [MODES.SIGNUP]: 'Zarejestruj się',
    [MODES.RESET]: 'Wyślij link do resetu',
  }[mode];

  const title = {
    [MODES.SIGNIN]: 'Zaloguj się, aby zarządzać finansami',
    [MODES.SIGNUP]: 'Utwórz konto',
    [MODES.RESET]: 'Zresetuj hasło',
  }[mode];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-white shadow-2xl p-8 space-y-6">
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
              <p className="text-gray-500 mt-1">{title}</p>
            </div>
          </div>

          <OfflineBanner />

          {sessionExpired && !error && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
              <svg className="mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>Twoja sesja wygasła. Zaloguj się ponownie, aby kontynuować.</span>
            </div>
          )}

          {infoMessage && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 flex items-start gap-2">
              <svg className="mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>{infoMessage}</span>
            </div>
          )}

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

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === MODES.SIGNUP && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nazwa użytkownika <span className="text-gray-400 font-normal">(opcjonalnie)</span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jan Kowalski"
                  autoComplete="name"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ty@example.com"
                autoComplete="email"
                required
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
            </div>

            {mode !== MODES.RESET && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hasło</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 znaków"
                  autoComplete={mode === MODES.SIGNUP ? 'new-password' : 'current-password'}
                  required
                  minLength={8}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                />
              </div>
            )}

            {mode === MODES.SIGNUP && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Powtórz hasło</label>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium py-2.5 shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Przetwarzanie...' : submitLabel}
            </button>
          </form>

          <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
            {mode === MODES.SIGNIN && (
              <>
                <button onClick={() => switchMode(MODES.SIGNUP)} className="hover:text-indigo-600 hover:underline">
                  Nie masz konta? Zarejestruj się
                </button>
                <button onClick={() => switchMode(MODES.RESET)} className="hover:text-indigo-600 hover:underline">
                  Zapomniałeś hasła?
                </button>
              </>
            )}
            {mode === MODES.SIGNUP && (
              <button onClick={() => switchMode(MODES.SIGNIN)} className="hover:text-indigo-600 hover:underline">
                ← Masz już konto? Zaloguj się
              </button>
            )}
            {mode === MODES.RESET && (
              <button onClick={() => switchMode(MODES.SIGNIN)} className="hover:text-indigo-600 hover:underline">
                ← Powrót do logowania
              </button>
            )}
          </div>

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
