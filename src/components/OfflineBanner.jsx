import React from 'react';

const WifiOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="2" x2="22" y2="22"></line>
    <path d="M8.5 16.5a5 5 0 0 1 7 0"></path>
    <path d="M2 8.82a15 15 0 0 1 4.17-2.65"></path>
    <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"></path>
    <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"></path>
    <path d="M5 12.86a10 10 0 0 1 5.17-2.87"></path>
    <line x1="12" y1="20" x2="12.01" y2="20"></line>
  </svg>
);

const SyncIcon = () => (
  <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
  </svg>
);

export default function OfflineBanner({ isOffline, pendingCount, isSyncing }) {
  if (!isOffline && !isSyncing && pendingCount === 0) return null;

  if (isSyncing) {
    return (
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2">
        <SyncIcon />
        <span>Synchronizowanie {pendingCount} {pendingCount === 1 ? 'operacji' : 'operacji'}...</span>
      </div>
    );
  }

  if (isOffline) {
    return (
      <div role="status" className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2">
        <WifiOffIcon />
        <span>
          Tryb offline — zmiany transakcji zsynchronizują się po połączeniu
          {pendingCount > 0 && (
            <span className="ml-1 inline-flex items-center bg-white/20 rounded-full px-2 py-0.5 text-xs">
              {pendingCount} do synchronizacji
            </span>
          )}
        </span>
      </div>
    );
  }

  return null;
}
