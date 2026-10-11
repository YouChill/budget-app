#!/usr/bin/env bash
# Testy migracji SQL na lokalnym PostgreSQL 15+ (bez Supabase).
#
#   PGHOST=/sciezka/do/socketu PGPORT=5432 PGUSER=postgres bash migration/tests/run_sql_tests.sh
#
# Tworzy i kasuje bazę tymczasową budget_test_014. Nie dotyka danych produkcyjnych.
set -euo pipefail
cd "$(dirname "$0")"
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
echo "OK: migracja, idempotencja i rollback"
