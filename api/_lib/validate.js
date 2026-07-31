/**
 * Walidacja i sanityzacja payloadów dla /api/v1/*.
 *
 * Każdy walidator zwraca { values, errors }:
 *   - values — obiekt zawierający WYŁĄCZNIE pola z białej listy
 *     (ochrona przed mass assignment: id / household_id / created_at
 *     przysłane przez klienta są pomijane),
 *   - errors — lista komunikatów; niepusta ⇒ żądanie kończy się 400.
 *
 * Tryb partial=true (PATCH) pozwala pominąć pola wymagane — waliduje
 * tylko te, które przysłano.
 */

export const TYPY = ['Wydatek', 'Przychód'];
export const ZAKRESY = ['monthly', 'yearly'];

const MAX_TEXT = 120;
const MAX_NOTE = 500;
const MAX_KWOTA = 999_999_999.99;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function cleanString(value, { max = MAX_TEXT } = {}) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function cleanNumber(value, { min, max } = {}) {
  const num = typeof value === 'number' ? value : Number(value);
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (!Number.isFinite(num)) return null;
  if (min !== undefined && num < min) return null;
  if (max !== undefined && num > max) return null;
  return num;
}

function cleanInt(value, { min, max } = {}) {
  const num = cleanNumber(value, { min, max });
  if (num === null || !Number.isInteger(num)) return null;
  return num;
}

/**
 * Generyczny walidator na bazie deklaratywnego schematu pól.
 * schema: { pole: { required, clean(value) → wartość|null, message } }
 */
function validate(body, schema, { partial = false } = {}) {
  const errors = [];
  const values = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { values, errors: ['Body żądania musi być obiektem JSON'] };
  }

  for (const [field, def] of Object.entries(schema)) {
    const present = body[field] !== undefined && body[field] !== null && body[field] !== '';

    if (!present) {
      if (def.required && !partial) {
        errors.push(`Pole "${field}" jest wymagane`);
      } else if (!def.required && body[field] !== undefined) {
        // jawnie przysłane null / '' dla pola opcjonalnego → zapis NULL
        values[field] = null;
      }
      continue;
    }

    const cleaned = def.clean(body[field]);
    if (cleaned === null) {
      errors.push(def.message || `Pole "${field}" ma nieprawidłową wartość`);
    } else {
      values[field] = cleaned;
    }
  }

  return { values, errors };
}

// ── TRANSAKCJE ──────────────────────────────────────────────────────────────

const transakcjaSchema = {
  data: {
    required: true,
    clean: v => (isValidDate(v) ? v : null),
    message: 'Pole "data" musi mieć format YYYY-MM-DD',
  },
  typ: {
    required: true,
    clean: v => (TYPY.includes(v) ? v : null),
    message: `Pole "typ" musi być jednym z: ${TYPY.join(', ')}`,
  },
  kwota: {
    required: true,
    clean: v => {
      const num = cleanNumber(v, { max: MAX_KWOTA });
      // kwoty przechowujemy jako wartości dodatnie — znak wynika z pola "typ"
      return num === null || num === 0 ? null : Math.abs(num);
    },
    message: `Pole "kwota" musi być liczbą różną od zera (maks. ${MAX_KWOTA})`,
  },
  kategoria: {
    required: true,
    clean: v => cleanString(v),
    message: `Pole "kategoria" musi być niepustym tekstem (maks. ${MAX_TEXT} znaków)`,
  },
  podkategoria: {
    required: false,
    clean: v => cleanString(v),
    message: `Pole "podkategoria" musi być tekstem (maks. ${MAX_TEXT} znaków)`,
  },
  osoba: {
    required: false,
    clean: v => cleanString(v),
    message: `Pole "osoba" musi być tekstem (maks. ${MAX_TEXT} znaków)`,
  },
  komentarz: {
    required: false,
    clean: v => cleanString(v, { max: MAX_NOTE }),
    message: `Pole "komentarz" musi być tekstem (maks. ${MAX_NOTE} znaków)`,
  },
};

export function validateTransakcja(body, opts) {
  return validate(body, transakcjaSchema, opts);
}

// ── KATEGORIE ───────────────────────────────────────────────────────────────

const kategoriaSchema = {
  typ: {
    required: true,
    clean: v => (TYPY.includes(v) ? v : null),
    message: `Pole "typ" musi być jednym z: ${TYPY.join(', ')}`,
  },
  kategoria: {
    required: true,
    clean: v => cleanString(v),
    message: `Pole "kategoria" musi być niepustym tekstem (maks. ${MAX_TEXT} znaków)`,
  },
  podkategoria: {
    required: false,
    clean: v => cleanString(v),
    message: `Pole "podkategoria" musi być tekstem (maks. ${MAX_TEXT} znaków)`,
  },
};

export function validateKategoria(body, opts) {
  return validate(body, kategoriaSchema, opts);
}

// ── OSOBY ───────────────────────────────────────────────────────────────────

const osobaSchema = {
  nazwa: {
    required: true,
    clean: v => cleanString(v),
    message: `Pole "nazwa" musi być niepustym tekstem (maks. ${MAX_TEXT} znaków)`,
  },
};

export function validateOsoba(body, opts) {
  return validate(body, osobaSchema, opts);
}

// ── BUDŻETY ─────────────────────────────────────────────────────────────────

const budzetSchema = {
  kategoria: {
    required: true,
    clean: v => cleanString(v),
    message: `Pole "kategoria" musi być niepustym tekstem (maks. ${MAX_TEXT} znaków)`,
  },
  limit_kwota: {
    required: true,
    clean: v => cleanNumber(v, { min: 0, max: MAX_KWOTA }),
    message: `Pole "limit_kwota" musi być liczbą ≥ 0 (maks. ${MAX_KWOTA})`,
  },
  zakres: {
    required: true,
    clean: v => (ZAKRESY.includes(v) ? v : null),
    message: `Pole "zakres" musi być jednym z: ${ZAKRESY.join(', ')}`,
  },
  rok: {
    required: true,
    clean: v => cleanInt(v, { min: 1970, max: 2100 }),
    message: 'Pole "rok" musi być liczbą całkowitą z zakresu 1970–2100',
  },
  miesiac: {
    required: false,
    clean: v => cleanInt(v, { min: 1, max: 12 }),
    message: 'Pole "miesiac" musi być liczbą całkowitą 1–12',
  },
  osoba: {
    required: false,
    clean: v => cleanString(v),
    message: `Pole "osoba" musi być tekstem (maks. ${MAX_TEXT} znaków)`,
  },
  notatki: {
    required: false,
    clean: v => cleanString(v, { max: MAX_NOTE }),
    message: `Pole "notatki" musi być tekstem (maks. ${MAX_NOTE} znaków)`,
  },
};

export function validateBudzet(body, opts = {}) {
  const result = validate(body, budzetSchema, opts);
  const { values, errors } = result;

  // Spójność zakres ↔ miesiac (odzwierciedla CHECK-i i unikalny indeks w bazie)
  const zakres = values.zakres ?? (opts.partial ? undefined : null);
  if (zakres === 'monthly' && values.miesiac === undefined) {
    errors.push('Budżet miesięczny (zakres=monthly) wymaga pola "miesiac"');
  }
  if (zakres === 'yearly') {
    values.miesiac = null;
  }

  return result;
}
