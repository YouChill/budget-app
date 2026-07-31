/**
 * Vercel Serverless Function — REST API /api/v1/*
 *
 * Pełny CRUD dla zasobów gospodarstwa domowego:
 *   GET    /api/v1/me                       — profil + gospodarstwo zalogowanego użytkownika
 *   GET    /api/v1/transakcje              — lista (filtry: rok, miesiac, od, do, typ, kategoria, osoba + paginacja)
 *   POST   /api/v1/transakcje              — utworzenie (obiekt lub tablica ≤ 500)
 *   GET    /api/v1/transakcje/:id          — pojedynczy rekord
 *   PUT    /api/v1/transakcje/:id          — pełna aktualizacja
 *   PATCH  /api/v1/transakcje/:id          — częściowa aktualizacja
 *   DELETE /api/v1/transakcje/:id          — usunięcie
 *   (analogicznie: /kategorie, /osoby, /budzety)
 *
 * Bezpieczeństwo:
 *   - Każde żądanie wymaga JWT sesji Supabase (Authorization: Bearer …).
 *   - Zapytania wykonuje klient z tokenem UŻYTKOWNIKA (klucz anon, nigdy
 *     service role) — polityki RLS z migracji 003/008 stanowią niezależną
 *     drugą warstwę izolacji gospodarstw.
 *   - household_id pochodzi wyłącznie z profilu użytkownika (serwer);
 *     wartości z body/query są ignorowane, a każde zapytanie jawnie
 *     filtruje po household_id (pierwsza warstwa izolacji).
 *   - Walidacja payloadów z białą listą pól (ochrona przed mass assignment).
 *   - Rekord spoza gospodarstwa i rekord nieistniejący dają identyczne 404
 *     (brak wycieku informacji o cudzych danych).
 */
import { createAuthContext } from '../_lib/auth.js';
import { ApiError, badRequest, notFound, fromDbError, sendError } from '../_lib/errors.js';
import {
  isUuid,
  validateTransakcja,
  validateKategoria,
  validateOsoba,
  validateBudzet,
  TYPY,
  ZAKRESY,
} from '../_lib/validate.js';

const MAX_BATCH = 500;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

// ── Pomocnicze ──────────────────────────────────────────────────────────────

function getSegments(req) {
  const route = req.query?.route;
  if (Array.isArray(route)) return route;
  if (typeof route === 'string') return route.split('/').filter(Boolean);
  return [];
}

function parsePagination(query) {
  const limit = Math.min(
    Math.max(parseInt(query.limit ?? DEFAULT_LIMIT, 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );
  const offset = Math.max(parseInt(query.offset ?? 0, 10) || 0, 0);
  return { limit, offset };
}

function parseIntParam(value, min, max, name) {
  if (value === undefined) return undefined;
  const num = parseInt(value, 10);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw badRequest(`Parametr "${name}" musi być liczbą całkowitą z zakresu ${min}–${max}`);
  }
  return num;
}

function parseDateParam(value, name) {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    throw badRequest(`Parametr "${name}" musi mieć format YYYY-MM-DD`);
  }
  return String(value);
}

function requireUuid(id) {
  if (!isUuid(id)) throw badRequest('Parametr ":id" musi być poprawnym UUID');
  return id;
}

function assertMethod(req, allowed, res) {
  if (!allowed.includes(req.method)) {
    res.setHeader('Allow', allowed.join(', '));
    throw new ApiError(405, 'Method not allowed');
  }
}

function assertValid({ values, errors }) {
  if (errors.length > 0) throw badRequest('Nieprawidłowe dane wejściowe', errors);
  if (Object.keys(values).length === 0) throw badRequest('Brak pól do zapisania');
  return values;
}

// ── Generyczny CRUD (wspólny dla wszystkich tabel) ──────────────────────────

/**
 * Konfiguracja zasobu:
 *   table    — nazwa tabeli w Supabase
 *   columns  — kolumny zwracane klientowi
 *   validate — walidator payloadu (validate.js)
 *   filters  — (query, builder) → builder; filtry listy specyficzne dla zasobu
 *   order    — [[kolumna, opts], …]
 */
const RESOURCES = {
  transakcje: {
    table: 'transakcje',
    columns: 'id, data, typ, kwota, kategoria, podkategoria, osoba, komentarz',
    validate: validateTransakcja,
    order: [['data', { ascending: false }], ['id', { ascending: false }]],
    filters(query, builder) {
      const rok = parseIntParam(query.rok, 1970, 2100, 'rok');
      const miesiac = parseIntParam(query.miesiac, 1, 12, 'miesiac');
      if (miesiac !== undefined && rok === undefined) {
        throw badRequest('Parametr "miesiac" wymaga podania "rok"');
      }
      if (rok !== undefined) {
        if (miesiac !== undefined) {
          const start = `${rok}-${String(miesiac).padStart(2, '0')}-01`;
          const end = miesiac === 12
            ? `${rok + 1}-01-01`
            : `${rok}-${String(miesiac + 1).padStart(2, '0')}-01`;
          builder = builder.gte('data', start).lt('data', end);
        } else {
          builder = builder.gte('data', `${rok}-01-01`).lt('data', `${rok + 1}-01-01`);
        }
      }
      const od = parseDateParam(query.od, 'od');
      const doDate = parseDateParam(query.do, 'do');
      if (od) builder = builder.gte('data', od);
      if (doDate) builder = builder.lte('data', doDate);
      if (query.typ !== undefined) {
        if (!TYPY.includes(query.typ)) throw badRequest(`Parametr "typ" musi być jednym z: ${TYPY.join(', ')}`);
        builder = builder.eq('typ', query.typ);
      }
      if (query.kategoria !== undefined) builder = builder.eq('kategoria', String(query.kategoria));
      if (query.osoba !== undefined) builder = builder.eq('osoba', String(query.osoba));
      return builder;
    },
  },
  kategorie: {
    table: 'kategorie',
    columns: 'id, typ, kategoria, podkategoria',
    validate: validateKategoria,
    order: [['typ', {}], ['kategoria', {}], ['podkategoria', {}]],
    filters(query, builder) {
      if (query.typ !== undefined) {
        if (!TYPY.includes(query.typ)) throw badRequest(`Parametr "typ" musi być jednym z: ${TYPY.join(', ')}`);
        builder = builder.eq('typ', query.typ);
      }
      return builder;
    },
  },
  osoby: {
    table: 'osoby',
    columns: 'id, nazwa',
    validate: validateOsoba,
    order: [['nazwa', {}]],
    filters: (query, builder) => builder,
  },
  budzety: {
    table: 'budzety',
    columns: 'id, kategoria, limit_kwota, miesiac, rok, osoba, zakres, notatki',
    validate: validateBudzet,
    order: [['rok', { ascending: false }], ['kategoria', {}], ['miesiac', {}]],
    filters(query, builder) {
      const rok = parseIntParam(query.rok, 1970, 2100, 'rok');
      const miesiac = parseIntParam(query.miesiac, 1, 12, 'miesiac');
      if (rok !== undefined) builder = builder.eq('rok', rok);
      if (miesiac !== undefined) builder = builder.eq('miesiac', miesiac);
      if (query.zakres !== undefined) {
        if (!ZAKRESY.includes(query.zakres)) throw badRequest(`Parametr "zakres" musi być jednym z: ${ZAKRESY.join(', ')}`);
        builder = builder.eq('zakres', query.zakres);
      }
      if (query.kategoria !== undefined) builder = builder.eq('kategoria', String(query.kategoria));
      return builder;
    },
  },
};

async function listRecords(ctx, resource, req, res) {
  const { limit, offset } = parsePagination(req.query);

  let builder = ctx.supabase
    .from(resource.table)
    .select(resource.columns, { count: 'exact' })
    .eq('household_id', ctx.householdId);

  builder = resource.filters(req.query, builder);
  for (const [column, opts] of resource.order) {
    builder = builder.order(column, opts);
  }

  const { data, error, count } = await builder.range(offset, offset + limit - 1);
  if (error) throw fromDbError(error);

  return res.status(200).json({ items: data, total: count, limit, offset });
}

async function getRecord(ctx, resource, id, res) {
  const { data, error } = await ctx.supabase
    .from(resource.table)
    .select(resource.columns)
    .eq('household_id', ctx.householdId)
    .eq('id', requireUuid(id))
    .maybeSingle();

  if (error) throw fromDbError(error);
  if (!data) throw notFound();
  return res.status(200).json(data);
}

async function createRecords(ctx, resource, req, res) {
  const body = req.body;
  const isBatch = Array.isArray(body);
  const inputs = isBatch ? body : [body];

  if (inputs.length === 0) throw badRequest('Tablica rekordów nie może być pusta');
  if (inputs.length > MAX_BATCH) {
    throw new ApiError(413, `Zbyt wiele rekordów — maksymalnie ${MAX_BATCH} na żądanie`);
  }

  const rows = inputs.map((input, i) => {
    const { values, errors } = resource.validate(input);
    if (errors.length > 0) {
      throw badRequest(
        isBatch ? `Nieprawidłowe dane wejściowe (rekord ${i})` : 'Nieprawidłowe dane wejściowe',
        errors
      );
    }
    // household_id nadawany WYŁĄCZNIE po stronie serwera
    return { ...values, household_id: ctx.householdId };
  });

  const { data, error } = await ctx.supabase
    .from(resource.table)
    .insert(rows)
    .select(resource.columns);

  if (error) throw fromDbError(error);
  return res.status(201).json(isBatch ? { items: data, count: data.length } : data[0]);
}

async function updateRecord(ctx, resource, id, req, res) {
  const partial = req.method === 'PATCH';
  const values = assertValid(resource.validate(req.body, { partial }));

  const { data, error } = await ctx.supabase
    .from(resource.table)
    .update(values)
    .eq('household_id', ctx.householdId)
    .eq('id', requireUuid(id))
    .select(resource.columns)
    .maybeSingle();

  if (error) throw fromDbError(error);
  if (!data) throw notFound();
  return res.status(200).json(data);
}

async function deleteRecord(ctx, resource, id, res) {
  const { data, error } = await ctx.supabase
    .from(resource.table)
    .delete()
    .eq('household_id', ctx.householdId)
    .eq('id', requireUuid(id))
    .select('id');

  if (error) throw fromDbError(error);
  if (!data || data.length === 0) throw notFound();
  return res.status(204).end();
}

async function handleResource(ctx, resource, segments, req, res) {
  const id = segments[1];
  if (segments.length > 2) throw notFound('Nieznana ścieżka');

  if (id === undefined) {
    assertMethod(req, ['GET', 'POST'], res);
    return req.method === 'GET'
      ? listRecords(ctx, resource, req, res)
      : createRecords(ctx, resource, req, res);
  }

  assertMethod(req, ['GET', 'PUT', 'PATCH', 'DELETE'], res);
  switch (req.method) {
    case 'GET':
      return getRecord(ctx, resource, id, res);
    case 'PUT':
    case 'PATCH':
      return updateRecord(ctx, resource, id, req, res);
    case 'DELETE':
      return deleteRecord(ctx, resource, id, res);
  }
}

async function handleMe(ctx, segments, req, res) {
  if (segments.length > 1) throw notFound('Nieznana ścieżka');
  assertMethod(req, ['GET'], res);

  const { data: household, error } = await ctx.supabase
    .from('households')
    .select('id, name')
    .eq('id', ctx.householdId)
    .maybeSingle();
  if (error) throw fromDbError(error);

  return res.status(200).json({
    user: { id: ctx.user.id, email: ctx.user.email },
    profile: { display_name: ctx.profile.display_name },
    household: household ?? { id: ctx.householdId, name: null },
  });
}

// ── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Odpowiedzi zawierają dane finansowe — zakaz cache'owania po drodze.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    const segments = getSegments(req);
    if (segments.length === 0) throw notFound('Nieznana ścieżka');

    // Uwierzytelnienie PRZED routingiem — żaden endpoint nie jest publiczny.
    const ctx = await createAuthContext(req);

    const [resourceName] = segments;
    if (resourceName === 'me') {
      return await handleMe(ctx, segments, req, res);
    }

    const resource = RESOURCES[resourceName];
    if (!resource) throw notFound('Nieznany zasób');

    return await handleResource(ctx, resource, segments, req, res);
  } catch (err) {
    return sendError(res, err);
  }
}
