/**
 * HMAC rachunków kontrahentów (#130).
 *
 * Pełny NRB nie trafia do bazy (zasada z migracji 014). Zapisujemy
 * HMAC-SHA256 z sekretem po stronie serwera: zrzut bazy bez sekretu nie
 * pozwala odtworzyć numerów słownikowo (zwykły sha256 z 26 cyfr z sumą
 * kontrolną da się przeliczyć). Domieszka householdId sprawia, że ten sam
 * rachunek w dwóch gospodarstwach daje różne wartości.
 *
 * Moduł nie loguje rachunków ani wyników.
 */
import { createHmac } from 'node:crypto';
import { kanonicznyRachunek } from '../../src/lib/odciski.js';
import { ApiError } from './errors.js';

const MIN_KLUCZ = 32; // bajty

/** Klucz z RACHUNEK_HMAC_KEY (base64, ≥ 32 bajty) albo 503. */
export function kluczHmac(env = process.env) {
  const raw = env.RACHUNEK_HMAC_KEY;
  const klucz = raw ? Buffer.from(raw, 'base64') : null;
  if (!klucz || klucz.length < MIN_KLUCZ) {
    throw new ApiError(503, 'HMAC rachunków nie jest skonfigurowany — ustaw RACHUNEK_HMAC_KEY (≥ 32 bajty, base64)');
  }
  return klucz;
}

/** HMAC (hex) rachunku w gospodarstwie; null dla rachunku niekanonicznego. */
export function hmacRachunku(klucz, householdId, rachunek) {
  const kanoniczny = kanonicznyRachunek(rachunek);
  if (!kanoniczny) return null;
  return createHmac('sha256', klucz).update(`${householdId}|${kanoniczny}`).digest('hex');
}
