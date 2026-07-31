/**
 * Wspólna obsługa błędów dla endpointów /api/v1/*.
 *
 * Zasada: klient dostaje tylko komunikat bezpieczny do ujawnienia
 * (bez szczegółów SQL/stacktrace) — pełny błąd trafia do logów serwera.
 */

export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export const unauthorized = (msg = 'Unauthorized — wymagana ważna sesja Supabase') =>
  new ApiError(401, msg);

export const forbidden = (msg = 'Brak dostępu') => new ApiError(403, msg);

export const notFound = (msg = 'Nie znaleziono zasobu') => new ApiError(404, msg);

export const badRequest = (msg, details = null) => new ApiError(400, msg, details);

/**
 * Tłumaczy błąd PostgREST/Postgres na bezpieczny ApiError.
 * Kody sesji (jak w src/services/api.js) → 401, konflikt unikalności → 409,
 * naruszenie CHECK/NOT NULL → 400. Reszta → generyczne 500.
 */
export function fromDbError(error) {
  if (!error) return new ApiError(500, 'Internal server error');

  const msg = (error.message || '').toLowerCase();
  const isSessionError =
    error.status === 401 ||
    error.status === 403 ||
    error.code === 'PGRST301' ||
    msg.includes('jwt expired') ||
    msg.includes('invalid token') ||
    msg.includes('token is expired');

  if (isSessionError) return unauthorized('Sesja wygasła lub token jest nieprawidłowy');
  if (error.code === '23505') return new ApiError(409, 'Rekord o tych wartościach już istnieje');
  if (error.code === '23502' || error.code === '23514' || error.code === '22P02') {
    return badRequest('Nieprawidłowe dane wejściowe');
  }
  // RLS odrzuciło zapis (WITH CHECK) — nie zdradzamy szczegółów polityk
  if (error.code === '42501') return forbidden();

  return new ApiError(500, 'Internal server error');
}

export function sendError(res, err) {
  const apiErr = err instanceof ApiError ? err : null;
  if (!apiErr || apiErr.status >= 500) {
    // Szczegóły wyłącznie w logach — nigdy w odpowiedzi HTTP
    console.error('[api/v1]', err);
  }
  if (apiErr) {
    const body = { error: apiErr.message };
    if (apiErr.details) body.details = apiErr.details;
    return res.status(apiErr.status).json(body);
  }
  return res.status(500).json({ error: 'Internal server error' });
}
