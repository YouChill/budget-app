#!/usr/bin/env bash
# Testy migracji SQL na lokalnym PostgreSQL 15+ (bez Supabase).
#
#   PGHOST=/sciezka/do/socketu PGPORT=5432 PGUSER=postgres bash migration/tests/run_sql_tests.sh
#
# Tworzy i kasuje bazę tymczasową budget_test_014 (migracje 014+). Nie dotyka danych produkcyjnych.
#
# Kolejność:
#   1. historyczne migracje z migration/ (014–016) z testami i rollbackami,
#   2. nowe migracje z supabase/migrations/ (bez nagłówka BASELINE — te już są
#      w bazie przez krok 1), każda z opcjonalnym:
#        supabase/tests/<nazwa>.test.sql     — asercje po migracji,
#        supabase/rollbacks/<nazwa>.sql      — sprawdzane: rollback → ponowne wdrożenie.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
DB=budget_test_014
psql -q -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
trap 'psql -q -d postgres -c "DROP DATABASE IF EXISTS $DB"' EXIT
run() { PGOPTIONS='-c client_min_messages=warning' psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run supabase_stub.sql
run 014_seed.sql
run ../014_dowody_i_zobowiazania.sql
run ../014_dowody_i_zobowiazania.sql   # idempotencja
run 014_dowody.test.sql
run ../rollback_014.sql
run ../014_dowody_i_zobowiazania.sql   # rollback → ponowne wdrożenie
run ../015_profiles_household_lock.sql
run ../015_profiles_household_lock.sql  # idempotencja
run 015_profiles.test.sql
run ../rollback_015.sql
run ../015_profiles_household_lock.sql  # rollback → ponowne wdrożenie
run 016_revoke.test.sql

shopt -s nullglob
for f in "$ROOT"/supabase/migrations/*.sql; do
  grep -q '^-- BASELINE:' "$f" && continue
  name="$(basename "$f" .sql)"
  # supabase db push wykonuje plik we własnej transakcji — jawne BEGIN/COMMIT
  # zamknęłoby ją w połowie i rozjechało historię migracji z bazą.
  if grep -qiE '^[[:space:]]*(BEGIN|COMMIT|ROLLBACK)[[:space:]]*;' "$f"; then
    echo "BŁĄD: $name zawiera BEGIN/COMMIT — usuń, CLI sam otwiera transakcję" >&2
    exit 1
  fi
  echo "→ $name"
  run "$f"
  [ -f "$ROOT/supabase/tests/$name.test.sql" ] && run "$ROOT/supabase/tests/$name.test.sql"
  if [ -f "$ROOT/supabase/rollbacks/$name.sql" ]; then
    run "$ROOT/supabase/rollbacks/$name.sql"
    run "$f"
  fi
done

echo "OK: migracja, idempotencja i rollback"
