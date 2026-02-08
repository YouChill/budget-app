# 💰 Budżet Domowy

Aplikacja do śledzenia domowych wydatków i przychodów. Stworzona z myślą o wspólnym zarządzaniu finansami przez pary/rodziny.

![React](https://img.shields.io/badge/React-19-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-38B2AC)
![Google Sheets](https://img.shields.io/badge/Backend-Google%20Sheets-green)

## ✨ Funkcjonalności

- 📊 **Dashboard** — podsumowanie miesiąca (przychody, wydatki, bilans)
- ➕ **Dodawanie i edycja transakcji** — z kategorią, podkategorią, osobą i komentarzem
- 📅 **Nawigacja miesięczna** — przeglądanie różnych miesięcy
- 🗑️ **Usuwanie transakcji**
- 👥 **Wieloosobowe** — oznaczanie kto wprowadził transakcję
- 🔐 **Autoryzacja Google OAuth 2.0** — logowanie kontem Google z weryfikacją JWT
- ☁️ **Synchronizacja** — dane w Google Sheets, dostępne z każdego urządzenia
- 📈 **Wykresy** — wykresy kołowe i słupkowe wydatków wg kategorii (Recharts)
- 💳 **Import CSV** — import wyciągów bankowych z automatycznym dopasowaniem kategorii
- 🎯 **Budżety** — ustawianie miesięcznych limitów wydatków wg kategorii

## 🛠️ Stack technologiczny

- **Frontend:** React 19 + Vite 6
- **Stylowanie:** Tailwind CSS 4
- **Wykresy:** Recharts
- **Import CSV:** PapaParse
- **Obsługa gestów:** react-swipeable
- **Autoryzacja:** Google Identity Services (OAuth 2.0, JWT)
- **Backend:** Google Sheets + Google Apps Script
- **Hosting:** Netlify / Vercel (opcjonalnie)

## 📋 Wymagania

- Node.js 18+
- Konto Google (do arkusza i autoryzacji OAuth)

## 🚀 Instalacja

### 1. Sklonuj repozytorium

```bash
git clone https://github.com/TWOJA-NAZWA/budzet-domowy.git
cd budzet-domowy
```

### 2. Zainstaluj zależności

```bash
npm install
```

### 3. Skonfiguruj zmienne środowiskowe

```bash
cp .env.example .env
```

Uzupełnij plik `.env`:

```env
VITE_API_URL=https://script.google.com/macros/s/TWOJ_KLUCZ/exec
VITE_GOOGLE_CLIENT_ID=TWOJ_CLIENT_ID.apps.googleusercontent.com
```

### 4. Skonfiguruj backend (Google Sheets + Apps Script)

Szczegółowa instrukcja: [SETUP_GOOGLE.md](./docs/SETUP_GOOGLE.md)

Krótko:
1. Utwórz nowy arkusz Google
2. Wklej skrypt Apps Script z pliku `google-apps-script/Code.gs`
3. Wdróż jako aplikację internetową
4. Skopiuj URL i wklej do `.env` jako `VITE_API_URL`

### 5. Skonfiguruj autoryzację Google OAuth

Szczegółowa instrukcja: [SETUP_AUTH.md](./docs/SETUP_AUTH.md)

Krótko:
1. Utwórz projekt w Google Cloud Console
2. Skonfiguruj OAuth 2.0 Client ID
3. Wklej Client ID do `.env` jako `VITE_GOOGLE_CLIENT_ID`

### 6. Uruchom lokalnie

```bash
npm run dev
```

Aplikacja będzie dostępna pod adresem: `http://localhost:5173`

## 📁 Struktura projektu

```
budzet-domowy/
├── src/
│   ├── App.jsx              # Główna aplikacja React
│   ├── main.jsx             # Punkt wejścia
│   ├── index.css            # Style Tailwind
│   ├── components/
│   │   └── LoginPage.jsx    # Strona logowania Google OAuth
│   └── contexts/
│       └── AuthContext.jsx   # Kontekst autoryzacji (JWT)
├── components/
│   ├── CategoryCharts.jsx   # Wykresy kategorii (Recharts)
│   ├── CSVImport.jsx        # Import CSV z banku
│   └── Budgets.jsx          # Zarządzanie budżetami
├── google-apps-script/
│   ├── Code.gs              # Backend Google Apps Script
│   └── appsscript.json      # Manifest GAS
├── docs/
│   ├── SETUP_GOOGLE.md      # Instrukcja konfiguracji Google Sheets
│   ├── SETUP_AUTH.md        # Instrukcja konfiguracji OAuth
│   └── CSV_IMPORT.md        # Dokumentacja importu CSV
├── public/                   # Zasoby statyczne (favicony, manifest)
├── index.html
├── package.json
├── vite.config.js
├── postcss.config.js
├── eslint.config.js
└── .env.example              # Szablon zmiennych środowiskowych
```

## 📊 Struktura danych w arkuszu

Aplikacja korzysta z 4 zakładek w arkuszu Google:

### Transakcje
| ID | Data | Typ | Kwota | Kategoria | Podkategoria | Osoba | Komentarz |
|----|------|-----|-------|-----------|--------------|-------|-----------|

### Kategorie
| Typ | Kategoria | Podkategoria |
|-----|-----------|--------------|

### Osoby
| Osoba |
|-------|

### Budżety
| Miesiąc | Kategoria | Limit |
|---------|-----------|-------|

## 🔧 Konfiguracja

### Zmienne środowiskowe

Konfiguracja odbywa się poprzez plik `.env` (skopiuj z `.env.example`):

| Zmienna | Opis |
|---------|------|
| `VITE_API_URL` | URL wdrożonego skryptu Google Apps Script |
| `VITE_GOOGLE_CLIENT_ID` | Client ID z Google Cloud Console (OAuth 2.0) |

### Domyślne kategorie

Kategorie są definiowane w skrypcie Google Apps Script w funkcji `initializeSpreadsheet()`. Możesz je edytować bezpośrednio w arkuszu Google lub zmodyfikować skrypt. Aplikacja zawiera 40+ predefiniowanych kategorii (Mieszkanie, Transport, Jedzenie, Zdrowie, Rozrywka, Odzież, Dom, Dzieci, Kredyty i inne).

## 🚢 Deployment

### Netlify

1. Zbuduj aplikację:
```bash
npm run build
```
2. Przeciągnij folder `dist` na [netlify.com](https://netlify.com)
3. Ustaw zmienne środowiskowe (`VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`) w ustawieniach projektu

### Vercel

1. Połącz repozytorium GitHub z [vercel.com](https://vercel.com)
2. Vercel automatycznie wykryje Vite i skonfiguruje build
3. Ustaw zmienne środowiskowe w ustawieniach projektu

**Ważne:** Dodaj domenę hostingu do **Authorized JavaScript origins** w ustawieniach OAuth w Google Cloud Console.

## 🗺️ Roadmap

- [x] MVP — dodawanie/usuwanie transakcji
- [x] Podsumowanie miesiąca
- [x] Optymalizacja ładowania danych
- [x] Autoryzacja Google OAuth 2.0
- [x] Wykresy kategorii (kołowe i słupkowe)
- [x] Import CSV z banku
- [x] Budżetowanie (plan vs realizacja)
- [x] Edycja transakcji
- [ ] Zarządzanie słownikami w aplikacji

## 🤝 Współtworzenie

Pull requesty są mile widziane! Przy większych zmianach proszę najpierw otworzyć issue.

## 📄 Licencja

MIT
