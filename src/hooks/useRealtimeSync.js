import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import * as api from '../services/api';

const TABLES = ['transakcje', 'kategorie', 'osoby'];

// Real-time subscriptions — nasłuchuje zmian w tabelach gospodarstwa i woła
// `onChange` (np. odświeżenie danych miesiąca). Callback trzymany w refie:
// zmiana jego tożsamości (nowy miesiąc) nie zrywa i nie odtwarza kanałów.
export function useRealtimeSync({ user, isOffline, onChange }) {
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (isOffline || !user) return; // Skip if offline or not authenticated

    let subscriptions = [];
    let cancelled = false;

    const setupSubscriptions = async () => {
      let householdId = null;
      try {
        householdId = (await api.getUserProfile()).household_id;
      } catch {
        return;
      }
      // Efekt posprzątany, zanim profil wrócił — nie zakładaj kanałów,
      // których nikt już nie zamknie.
      if (!householdId || cancelled) return;

      subscriptions = TABLES.map(table =>
        supabase
          .channel(`${table}:${householdId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` },
            () => onChangeRef.current?.()
          )
          .subscribe()
      );
    };

    setupSubscriptions();

    return () => {
      cancelled = true;
      subscriptions.forEach(channel => supabase.removeChannel(channel));
    };
  }, [user, isOffline]);
}
