import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createHousehold, joinHousehold } from '../services/api';

export default function FamilySetupPage({ onSetupComplete }) {
  const { user, logout } = useAuth();
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!familyName.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      await createHousehold(familyName.trim());
      onSetupComplete();
    } catch (err) {
      setError(err.message || 'Nie udało się stworzyć rodziny. Spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    const code = inviteCode.trim().toUpperCase();
    if (!code) return;
    setIsLoading(true);
    setError(null);
    try {
      await joinHousehold(code);
      onSetupComplete();
    } catch (err) {
      setError(err.message || 'Nieprawidłowy kod zaproszenia. Sprawdź kod i spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-white shadow-2xl p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Witaj, {user?.name?.split(' ')[0] || 'nowy użytkowniku'}!</h1>
              <p className="text-gray-500 mt-1 text-sm">
                Aby korzystać z aplikacji, stwórz nową rodzinę<br />lub dołącz do istniejącej.
              </p>
            </div>
          </div>

          {/* Error */}
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

          {/* Mode selection or forms */}
          {!mode ? (
            <div className="space-y-3">
              <button
                onClick={() => setMode('create')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-indigo-100 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center text-indigo-600 shrink-0 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Stwórz nową rodzinę</p>
                  <p className="text-sm text-gray-500">Ty będziesz właścicielem. Możesz zaprosić innych kodem.</p>
                </div>
              </button>

              <button
                onClick={() => setMode('join')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center text-gray-600 shrink-0 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                    <polyline points="10 17 15 12 10 7"></polyline>
                    <line x1="15" y1="12" x2="3" y2="12"></line>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Dołącz do rodziny</p>
                  <p className="text-sm text-gray-500">Masz kod zaproszenia od właściciela konta.</p>
                </div>
              </button>
            </div>
          ) : mode === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nazwa rodziny
                </label>
                <input
                  type="text"
                  value={familyName}
                  onChange={e => setFamilyName(e.target.value)}
                  placeholder="np. Rodzina Kowalskich"
                  maxLength={50}
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setMode(null); setError(null); }}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Wróć
                </button>
                <button
                  type="submit"
                  disabled={!familyName.trim() || isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                    </svg>
                  ) : null}
                  Stwórz rodzinę
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Kod zaproszenia
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="np. AB12CD34"
                  maxLength={8}
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-sm font-mono tracking-widest text-center uppercase"
                />
                <p className="text-xs text-gray-400 mt-1">8-znakowy kod od właściciela konta rodzinnego.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setMode(null); setError(null); }}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Wróć
                </button>
                <button
                  type="submit"
                  disabled={inviteCode.trim().length < 6 || isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                    </svg>
                  ) : null}
                  Dołącz
                </button>
              </div>
            </form>
          )}

          {/* Logout link */}
          <div className="border-t border-gray-100 pt-4 text-center">
            <button
              onClick={logout}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Wyloguj się ({user?.email})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
