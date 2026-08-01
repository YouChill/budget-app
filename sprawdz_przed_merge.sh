#!/usr/bin/env bash
#
# Kontrola przed merge: czy do repozytorium nie trafiły dane finansowe.
#
# Uruchom z korzenia projektu:
#   bash sprawdz_przed_merge.sh
#
set -uo pipefail

CZERWONY=$'\033[31m'; ZOLTY=$'\033[33m'; ZIELONY=$'\033[32m'; SZARY=$'\033[90m'; RESET=$'\033[0m'
znaleziono=0

# ── 1. Pliki wrażliwe śledzone przez git ────────────────────────────────────
# Wzorce dopasowywane do NAZW plików, z rozróżnieniem wielkości liter:
# 'IMPORT_' to prefiks payloadu z danymi, ale 'import_' bywa częścią nazwy
# zwykłego skryptu (import_do_aplikacji.mjs).
echo "── 1. Pliki wrażliwe śledzone przez git ──"
WZORCE=(
  'Zestawienie'
  'Historia_transakcji'
  'account-statement'
  'transaction-history'
  'IMPORT_.*\.json'
  'ODTWORZENIE_'
  'allegro_.*\.\(json\|csv\)'
  'FINAL_.*\.csv'
  '\.numbers'
)
for w in "${WZORCE[@]}"; do
  pliki=$(git ls-files | grep -- "$w" || true)
  if [ -n "$pliki" ]; then
    echo "${CZERWONY}✗ wzorzec '$w':${RESET}"
    echo "$pliki" | sed 's/^/    /'
    znaleziono=1
  fi
done
[ $znaleziono -eq 0 ] && echo "${ZIELONY}✓ czysto${RESET}"

# ── 2. Prawdziwe sekrety w treści ───────────────────────────────────────────
# Szukamy WARTOŚCI, nie nazw zmiennych ani przykładów w dokumentacji:
#  * pełny JWT — trzy segmenty base64 po min. 20 znaków
#  * przypisanie klucza z wartością dłuższą niż 20 znaków
# Placeholdery typu 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' nie mają
# trzech segmentów, więc nie trafiają.
echo
echo "── 2. Sekrety w treści plików ──"
JWT='eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'
# Prawdziwy klucz Supabase ma ponad 200 znaków; placeholder w dokumentacji
# kończy się wielokropkiem i jest krótszy. Próg 60 znaków rozdziela jedno od
# drugiego, a wykluczenie '...' domyka przypadki brzegowe.
PRZYP='(SERVICE_ROLE_KEY|ANON_KEY|PASSWORD|API_KEY)[[:space:]]*=[[:space:]]*.?[A-Za-z0-9_/+.-]{60,}'
trafienia=""
while IFS= read -r f; do
  [ -f "$f" ] || continue
  case "$f" in
    *.env.example|*package-lock.json|*.gitignore|*sprawdz_przed_merge.sh) continue ;;
  esac
  # pomijamy linie z wielokropkiem — to zapis skrócony w dokumentacji
  if grep -E "$JWT|$PRZYP" "$f" 2>/dev/null | grep -qv '\.\.\.'; then
    trafienia="${trafienia}${f}"$'\n'
  fi
done < <(git ls-files)

if [ -n "$trafienia" ]; then
  echo "${CZERWONY}✗ prawdziwe sekrety w:${RESET}"
  echo "$trafienia" | sed '/^$/d;s/^/    /'
  znaleziono=1
else
  echo "${ZIELONY}✓ czysto${RESET}"
  echo "${SZARY}  (wzmianki o service_role w dokumentacji i nazwy zmiennych"
  echo "   w kodzie są pomijane — liczą się tylko wartości kluczy)${RESET}"
fi

# ── 3. Czy .gitignore obejmuje pliki leżące w katalogu ──────────────────────
echo
echo "── 3. Czy .gitignore działa ──"
nieignorowane=$(git status --porcelain --untracked-files=all 2>/dev/null \
  | awk '/^\?\?/ {print $2}' \
  | grep -E 'Zestawienie|Historia_transakcji|IMPORT_.*\.json|ODTWORZENIE_|allegro_.*\.(json|csv)|FINAL_.*\.csv|\.numbers|account-statement|transaction-history' || true)
if [ -n "$nieignorowane" ]; then
  echo "${ZOLTY}⚠ te pliki leżą w katalogu i NIE są ignorowane:${RESET}"
  echo "$nieignorowane" | sed 's/^/    /'
  echo "  → dopisz wzorce do .gitignore albo przenieś pliki poza repo"
  znaleziono=1
else
  echo "${ZIELONY}✓ wszystkie dane finansowe poprawnie ignorowane${RESET}"
fi

echo
if [ $znaleziono -eq 0 ]; then
  echo "${ZIELONY}Gotowe do merge.${RESET}"
else
  echo "${CZERWONY}Sprawdź powyższe przed merge.${RESET}"
  echo
  echo "Plik już śledzony — samo .gitignore nie wystarczy:"
  echo "  git rm --cached SCIEZKA && git commit -m 'Usuń dane finansowe ze śledzenia'"
  echo
  echo "Plik w historii commitów:"
  echo "  git filter-repo --path SCIEZKA --invert-paths"
  exit 1
fi