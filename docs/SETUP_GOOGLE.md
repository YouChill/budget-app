# Konfiguracja Google Sheets jako backend

Ten dokument opisuje krok po kroku jak skonfigurować Google Sheets i Google Apps Script jako backend dla aplikacji Budżet Domowy.

## Krok 1: Utwórz arkusz Google

1. Wejdź na [Google Sheets](https://sheets.google.com)
2. Kliknij **+ Pusty** aby utworzyć nowy arkusz
3. Nazwij go np. "Budżet Domowy"
4. Udostępnij żonie/partnerowi jako **Edytor** (przycisk "Udostępnij" w prawym górnym rogu)

## Krok 2: Otwórz edytor Apps Script

1. W arkuszu kliknij **Rozszerzenia** → **Apps Script**
2. Otworzy się nowa karta z edytorem kodu

## Krok 3: Wklej skrypt

1. Zaznacz całą zawartość domyślnego pliku `Kod.gs` i **usuń ją**
2. Skopiuj całą zawartość pliku `google-apps-script/Code.gs` z tego repozytorium
3. Wklej do edytora
4. **Ważne:** Znajdź linię z `SPREADSHEET_ID` i zamień na ID swojego arkusza:

```javascript
const SPREADSHEET_ID = 'TUTAJ_WKLEJ_ID_ARKUSZA';
```

**Gdzie znaleźć ID arkusza?**

Z adresu URL arkusza:
```
https://docs.google.com/spreadsheets/d/1aOsVs9g2fRxFK8x29ZS3B_4xYHqevswAkZtktmWtZGQ/edit
                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                        To jest ID arkusza
```

5. Zapisz skrypt: **Ctrl+S** lub ikona dyskietki

## Krok 4: Zainicjalizuj arkusz

1. W edytorze Apps Script, z listy rozwijanej wybierz funkcję **initializeSpreadsheet**
2. Kliknij **Uruchom**
3. Google poprosi o autoryzację:
   - Kliknij "Przejrzyj uprawnienia"
   - Wybierz swoje konto Google
   - Kliknij "Zaawansowane" → "Przejdź do Budżet Domowy (niebezpieczne)"
   - Kliknij "Zezwól"
4. Wróć do arkusza — powinny pojawić się 3 zakładki:
   - **Transakcje** — pusta tabela z nagłówkami
   - **Kategorie** — wypełniona domyślnymi kategoriami
   - **Osoby** — wypełniona (Mąż, Żona)

## Krok 5: Wdróż jako aplikację internetową

1. W edytorze Apps Script kliknij **Wdróż** → **Nowe wdrożenie**
2. Kliknij ikonę ⚙️ (koło zębate) i wybierz **Aplikacja internetowa**
3. Wypełnij:
   - **Opis:** np. "Budżet API v1"
   - **Wykonaj jako:** Ja
   - **Kto ma dostęp:** Każdy
4. Kliknij **Wdróż**
5. **Skopiuj URL aplikacji** — będzie wyglądał tak:
   ```
   https://script.google.com/macros/s/AKfycbz.../exec
   ```

## Krok 6: Skonfiguruj aplikację React

1. Otwórz plik `src/App.jsx`
2. Znajdź linię:
   ```javascript
   const API_URL = '...';
   ```
3. Wklej skopiowany URL

## Aktualizacja skryptu

Gdy wprowadzasz zmiany w skrypcie Apps Script:

1. Zapisz zmiany (**Ctrl+S**)
2. Kliknij **Wdróż** → **Zarządzaj wdrożeniami**
3. Kliknij ikonę ołówka (edytuj)
4. W polu "Wersja" wybierz **Nowa wersja**
5. Kliknij **Wdróż**

**Uwaga:** URL pozostaje ten sam, nie trzeba go zmieniać w aplikacji.

## Rozwiązywanie problemów

### "Nie masz uprawnień"
- Upewnij się, że w opcji "Kto ma dostęp" wybrałeś "Każdy"

### "Nie znaleziono arkusza"
- Sprawdź czy `SPREADSHEET_ID` jest poprawny

### Dane się nie ładują
- Sprawdź konsolę przeglądarki (F12 → Console) czy nie ma błędów CORS
- Upewnij się, że skrypt został wdrożony jako nowa wersja po zmianach

### Brak zakładek w arkuszu
- Uruchom ponownie funkcję `initializeSpreadsheet` w edytorze Apps Script
