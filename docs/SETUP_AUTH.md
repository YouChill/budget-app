# Konfiguracja Google OAuth 2.0

Instrukcja krok po kroku jak skonfigurować autentykację Google OAuth w aplikacji Budżet Domowy.

## 1. Utwórz projekt w Google Cloud Console

1. Przejdź do [Google Cloud Console](https://console.cloud.google.com/)
2. Utwórz nowy projekt (lub wybierz istniejący)
3. Przejdź do **APIs & Services > OAuth consent screen**
4. Wybierz **External** (lub Internal jeśli masz Google Workspace)
5. Wypełnij wymagane pola:
   - **App name**: Budżet Domowy
   - **User support email**: Twój email
   - **Developer contact information**: Twój email
6. Kliknij **Save and Continue**
7. W sekcji **Scopes** dodaj: `email`, `profile`, `openid`
8. Kliknij **Save and Continue**
9. W sekcji **Test users** dodaj email-e osób które mają mieć dostęp (wymagane dopóki app jest w trybie "Testing")
10. Kliknij **Save and Continue**

## 2. Utwórz OAuth Client ID

1. Przejdź do **APIs & Services > Credentials**
2. Kliknij **Create Credentials > OAuth client ID**
3. Wybierz **Web application**
4. Nadaj nazwę (np. "Budżet Domowy Frontend")
5. W **Authorized JavaScript origins** dodaj:
   - `http://localhost:5173` (dla lokalnego developmentu)
   - `https://twoja-domena.netlify.app` (dla produkcji)
   - Inne domeny na których hostujesz aplikację
6. Kliknij **Create**
7. Skopiuj **Client ID** (wygląda jak: `123456789-abc.apps.googleusercontent.com`)

## 3. Skonfiguruj frontend

1. Skopiuj `.env.example` do `.env`:
   ```bash
   cp .env.example .env
   ```

2. Uzupełnij `VITE_GOOGLE_CLIENT_ID` w pliku `.env`:
   ```
   VITE_API_URL=https://script.google.com/macros/s/TWOJ_KLUCZ/exec
   VITE_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
   ```

3. Przebuduj aplikację:
   ```bash
   npm run build
   ```

## 4. Skonfiguruj backend (Google Apps Script)

### Zaktualizuj kod

Skopiuj zawartość `google-apps-script/Code.gs` do edytora Google Apps Script.

### Opcjonalnie: Ogranicz dostęp do wybranych email-i

Aby ograniczyć dostęp tylko do konkretnych kont Google:

1. W edytorze Google Apps Script przejdź do **Project Settings** (ikona koła zębatego)
2. Przewiń do sekcji **Script Properties**
3. Dodaj nową właściwość:
   - **Key**: `ALLOWED_EMAILS`
   - **Value**: lista email-i oddzielona przecinkami, np.: `jan@gmail.com,anna@gmail.com`
4. Kliknij **Save**

Jeśli `ALLOWED_EMAILS` nie jest ustawiony, wszyscy zalogowani użytkownicy Google mają dostęp.

### Wdróż ponownie Apps Script

1. Kliknij **Deploy > New deployment**
2. Wybierz typ: **Web app**
3. Ustaw:
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Kliknij **Deploy**
5. Zaktualizuj `VITE_API_URL` w `.env` jeśli URL się zmienił

## 5. Przetestuj

1. Uruchom aplikację lokalnie: `npm run dev`
2. Powinna pojawić się strona logowania
3. Kliknij "Sign in with Google"
4. Zaloguj się kontem Google które jest na whitelist
5. Powinny załadować się dane z arkusza

## Rozwiązywanie problemów

### "Brak konfiguracji Google OAuth"
- Sprawdź czy `VITE_GOOGLE_CLIENT_ID` jest ustawiony w `.env`
- Przebuduj aplikację po zmianie `.env`

### "Nieprawidłowy token autoryzacji"
- Sprawdź czy Client ID w `.env` zgadza się z tym w Google Cloud Console
- Sprawdź czy domena jest dodana w Authorized JavaScript origins

### "Brak dostępu — Twoje konto nie jest na liście autoryzowanych użytkowników"
- Dodaj email użytkownika do `ALLOWED_EMAILS` w Script Properties
- Lub usuń `ALLOWED_EMAILS` aby zezwolić wszystkim zalogowanym użytkownikom

### Token wygasa po godzinie
- Google ID tokeny mają czas życia ~1 godzina
- Po wygaśnięciu tokena użytkownik zostanie automatycznie przekierowany na stronę logowania
- Ponowne zalogowanie się odświeża token

### Consent screen w trybie "Testing"
- W trybie Testing tylko użytkownicy dodani jako Test users mogą się logować
- Aby umożliwić logowanie wszystkim, opublikuj consent screen (wymaga weryfikacji Google)
