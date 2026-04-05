import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

// ─── Ikona Google ─────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
function Spinner({ size = 20 }) {
  return (
    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
    </svg>
  );
}

// ─── Baner offline ────────────────────────────────────────────────────────────
function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  React.useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
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

// ─── Główny komponent ─────────────────────────────────────────────────────────
export default function LoginPage() {
  const { error, setError, isLoading, sessionExpired, loginWithGoogle, loginWithEmail, signUp, resetPassword } = useAuth();

  // Tryby: 'login' | 'register' | 'reset'
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    setSuccessMsg(null);
    setPassword('');
    setPasswordConfirm('');
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (mode === 'register') {
      if (password !== passwordConfirm) { setError('Hasła nie są identyczne.'); return; }
      if (password.length < 6) { setError('Hasło musi mieć co najmniej 6 znaków.'); return; }
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else if (mode === 'register') {
        const { success, needsConfirmation } = await signUp(email, password);
        if (success) {
          if (needsConfirmation) {
            setSuccessMsg('Konto utworzone! Sprawdź skrzynkę email i kliknij link aktywacyjny.');
            switchMode('login');
          }
          // Jeśli needsConfirmation=false, onAuthStateChange sam zaloguje użytkownika
        }
      } else if (mode === 'reset') {
        const ok = await resetPassword(email);
        if (ok) {
          setSuccessMsg('Link do resetowania hasła został wysłany na podany adres email.');
          switchMode('login');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading state (sprawdzanie sesji) ──────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-indigo-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Spinner size={24} />
          <span className="text-sm">Ładowanie aplikacji...</span>
        </div>
      </div>
    );
  }

  const isLogin = mode === 'login';
  const isRegister = mode === 'register';
  const isReset = mode === 'reset';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-white shadow-2xl p-8 space-y-6">

          {/* Logo i tytuł */}
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
              <p className="text-gray-500 mt-1">
                {isLogin && 'Zaloguj się, aby zarządzać finansami'}
                {isRegister && 'Utwórz nowe konto'}
                {isReset && 'Resetowanie hasła'}
              </p>
            </div>
          </div>

          {/* Baner offline */}
          <OfflineBanner />

          {/* Sesja wygasła */}
          {sessionExpired && !error && !successMsg && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
              <svg className="mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>Twoja sesja wygasła. Zaloguj się ponownie.</span>
            </div>
          )}

          {/* Komunikat sukcesu */}
          {successMsg && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-start gap-2">
              <svg className="mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Błąd */}
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 flex items-start gap-2">
              <svg className="mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <div className="flex-1">
                {error}
                <button onClick={() => setError(null)} className="ml-2 font-medium hover:underline">Zamknij</button>
              </div>
            </div>
          )}

          {/* Formularz email/hasło */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Adres email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="twoj@email.pl"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
              />
            </div>

            {!isReset && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Hasło
                </label>
                <input
                  type="password"
                  required
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                />
              </div>
            )}

            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Powtórz hasło
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={e => setPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                />
              </div>
            )}

            {isLogin && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="text-xs text-indigo-500 hover:text-indigo-700 hover:underline"
                >
                  Zapomniałem hasła
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium py-2.5 text-sm transition-colors"
            >
              {submitting ? <Spinner size={16} /> : null}
              {isLogin && (submitting ? 'Logowanie...' : 'Zaloguj się')}
              {isRegister && (submitting ? 'Rejestracja...' : 'Zarejestruj się')}
              {isReset && (submitting ? 'Wysyłanie...' : 'Wyślij link resetujący')}
            </button>
          </form>

          {/* Separator lub/lub */}
          {!isReset && (
            <>
              <div className="relative flex items-center gap-3">
                <div className="flex-1 border-t border-gray-200"></div>
                <span className="text-xs text-gray-400 shrink-0">lub</span>
                <div className="flex-1 border-t border-gray-200"></div>
              </div>

              {/* Logowanie przez Google */}
              <button
                type="button"
                onClick={loginWithGoogle}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 py-2.5 text-sm text-gray-700 font-medium transition-colors"
              >
                <GoogleIcon />
                Kontynuuj z Google
              </button>
            </>
          )}

          {/* Przełącznik tryb login/register/reset */}
          <div className="border-t border-gray-100 pt-4 text-center space-y-2">
            {(isLogin || isReset) && (
              <p className="text-sm text-gray-500">
                Nie masz konta?{' '}
                <button onClick={() => switchMode('register')} className="font-medium text-indigo-600 hover:underline">
                  Zarejestruj się
                </button>
              </p>
            )}
            {(isRegister || isReset) && (
              <p className="text-sm text-gray-500">
                Masz już konto?{' '}
                <button onClick={() => switchMode('login')} className="font-medium text-indigo-600 hover:underline">
                  Zaloguj się
                </button>
              </p>
            )}
            <p className="text-xs text-gray-400">
              Dane są przechowywane w Supabase PostgreSQL.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
