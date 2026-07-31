/**
 * Uwierzytelnienie i kontekst gospodarstwa dla endpointów /api/v1/*.
 *
 * Model bezpieczeństwa (dwie niezależne warstwy):
 *   1. Klient Supabase tworzony jest z tokenem JWT użytkownika (nie service
 *      role!), więc każde zapytanie przechodzi przez polityki RLS
 *      (migracje 003/008) — nawet błąd w kodzie API nie ujawni danych
 *      cudzego gospodarstwa.
 *   2. household_id jest zawsze wyznaczany po stronie serwera z profilu
 *      zalogowanego użytkownika i jawnie filtruje każde zapytanie.
 *      Wartości household_id przysłane przez klienta są ignorowane.
 */
import { createClient } from '@supabase/supabase-js';

import { unauthorized, forbidden, ApiError } from './errors.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

/**
 * Weryfikuje token sesji i zwraca kontekst żądania:
 *   { supabase, user, householdId }
 *
 * Rzuca ApiError 401 (brak/nieważny token), 403 (profil bez gospodarstwa)
 * lub 503 (brak konfiguracji środowiska).
 */
export async function createAuthContext(req) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new ApiError(503, 'API nie jest skonfigurowane — brak SUPABASE_URL / SUPABASE_ANON_KEY');
  }

  const token = getBearerToken(req);
  if (!token) {
    throw unauthorized('Brak tokenu — wymagany nagłówek Authorization: Bearer <token>');
  }

  // Klient działający w imieniu użytkownika: klucz anon + JWT sesji.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw unauthorized('Sesja wygasła lub token jest nieprawidłowy');
  }
  const user = data.user;

  // household_id wyłącznie z profilu (RLS: profiles_select_own) — nigdy z body/query.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('household_id, display_name, email')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw forbidden('Brak profilu użytkownika');
  }
  if (!profile.household_id) {
    throw forbidden('Profil użytkownika nie ma przypisanego gospodarstwa (household)');
  }

  return { supabase, user, profile, householdId: profile.household_id };
}
