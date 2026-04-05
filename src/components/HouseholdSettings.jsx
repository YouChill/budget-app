import React, { useState, useEffect, useCallback } from 'react';
import {
  getHouseholdInfo,
  createInvitation,
  getActiveInvitations,
  revokeInvitation,
  leaveHousehold,
} from '../services/api';

const INVITE_STORAGE_KEY = 'pending_invite_token';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildInviteUrl(token) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('invite', token);
  return url.toString();
}

function formatExpiry(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Ikony ────────────────────────────────────────────────────────────────────
const IconUsers = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const IconLink = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
  </svg>
);

const IconCopy = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
    <path d="M10 11v6"></path><path d="M14 11v6"></path>
    <path d="M9 6V4h6v2"></path>
  </svg>
);

const IconLogOut = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
);

const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

// ─── Komponent główny ─────────────────────────────────────────────────────────

export default function HouseholdSettings({ showError, showSuccess }) {
  const [info, setInfo] = useState(null); // { household, members }
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [infoData, invData] = await Promise.all([
        getHouseholdInfo(),
        getActiveInvitations(),
      ]);
      setInfo(infoData);
      setInvitations(invData);
    } catch (err) {
      showError('Nie udało się załadować danych rodziny: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { load(); }, [load]);

  const handleCreateInvite = async () => {
    setCreating(true);
    try {
      const { token } = await createInvitation();
      const url = buildInviteUrl(token);
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 3000);
      showSuccess('Link zaproszenia skopiowany do schowka!');
      await load();
    } catch (err) {
      showError('Nie udało się wygenerować zaproszenia: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCopyExisting = async (token) => {
    try {
      await navigator.clipboard.writeText(buildInviteUrl(token));
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 3000);
    } catch {
      showError('Nie udało się skopiować linku.');
    }
  };

  const handleRevoke = async (id) => {
    try {
      await revokeInvitation(id);
      showSuccess('Zaproszenie odwołane.');
      setInvitations(prev => prev.filter(inv => inv.id !== id));
    } catch (err) {
      showError('Nie udało się odwołać zaproszenia: ' + err.message);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await leaveHousehold();
      showSuccess('Opuściłeś rodzinę. Twoje dane są teraz prywatne.');
      setConfirmLeave(false);
      await load();
    } catch (err) {
      showError('Nie udało się opuścić rodziny: ' + err.message);
    } finally {
      setLeaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
        <svg className="animate-spin mr-2" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg>
        Ładowanie...
      </div>
    );
  }

  const isSolo = info?.members?.length <= 1;

  return (
    <div className="space-y-5">

      {/* Nazwa rodziny + liczba członków */}
      <div className="rounded-2xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <IconUsers />
          <span>{info?.household?.name ?? 'Moja rodzina'}</span>
          <span className="ml-auto text-xs text-gray-400">
            {info?.members?.length ?? 0} {info?.members?.length === 1 ? 'osoba' : 'osoby/osób'}
          </span>
        </div>

        {/* Lista członków */}
        <ul className="space-y-1">
          {info?.members?.map(m => (
            <li key={m.id} className="flex items-center gap-2 text-sm text-gray-600 py-1 px-2 rounded-lg hover:bg-gray-50">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {(m.display_name || m.email).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{m.display_name || m.email}</p>
                {m.display_name && (
                  <p className="text-xs text-gray-400 truncate">{m.email}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Zaproszenia */}
      <div className="rounded-2xl border border-gray-200 p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Zaproś do rodziny</p>
        <p className="text-xs text-gray-500">
          Link jest ważny przez 7 dni. Osoba, która go otworzy, dołączy do Twojej rodziny i będzie widzieć wspólny budżet.
        </p>

        <button
          onClick={handleCreateInvite}
          disabled={creating}
          className="flex items-center gap-2 w-full justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium py-2.5 transition-colors"
        >
          <IconLink />
          {creating ? 'Generowanie...' : 'Wygeneruj i skopiuj link'}
        </button>

        {/* Aktywne zaproszenia */}
        {invitations.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium text-gray-500">Aktywne zaproszenia:</p>
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-gray-500 truncate">{inv.token}</p>
                  <p className="text-xs text-gray-400">Wygasa {formatExpiry(inv.expires_at)}</p>
                </div>
                <button
                  onClick={() => handleCopyExisting(inv.token)}
                  className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors shrink-0"
                  title="Kopiuj link"
                >
                  {copiedToken === inv.token ? <IconCheck /> : <IconCopy />}
                </button>
                <button
                  onClick={() => handleRevoke(inv.id)}
                  className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-400 transition-colors shrink-0"
                  title="Odwołaj zaproszenie"
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Opuść rodzinę */}
      {!isSolo && (
        <div className="rounded-2xl border border-rose-100 p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Opuść rodzinę</p>
          <p className="text-xs text-gray-500">
            Twoje dane pozostaną na Twoim koncie. Inni członkowie nadal będą widzieć wspólny budżet bez Twoich przyszłych wpisów.
          </p>

          {confirmLeave ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-rose-600">Na pewno chcesz opuścić rodzinę?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleLeave}
                  disabled={leaving}
                  className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-sm font-medium py-2 transition-colors"
                >
                  {leaving ? 'Opuszczanie...' : 'Tak, opuść'}
                </button>
                <button
                  onClick={() => setConfirmLeave(false)}
                  className="flex-1 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 transition-colors"
                >
                  Anuluj
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmLeave(true)}
              className="flex items-center gap-2 w-full justify-center rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 text-sm font-medium py-2.5 transition-colors"
            >
              <IconLogOut />
              Opuść rodzinę
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Hook: obsługa tokenu zaproszenia z URL ───────────────────────────────────

/**
 * Zwraca token zaproszenia z ?invite=TOKEN lub z sessionStorage (jeśli user
 * nie był zalogowany w momencie otwarcia linku).
 */
export function getPendingInviteToken() {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('invite');
  if (urlToken) {
    sessionStorage.setItem(INVITE_STORAGE_KEY, urlToken);
    // Usuń token z URL bez przeładowania strony
    const clean = new URL(window.location.href);
    clean.searchParams.delete('invite');
    window.history.replaceState({}, '', clean.toString());
    return urlToken;
  }
  return sessionStorage.getItem(INVITE_STORAGE_KEY);
}

export function clearPendingInviteToken() {
  sessionStorage.removeItem(INVITE_STORAGE_KEY);
}
