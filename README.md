# 💰 Budżet Domowy

Aplikacja do śledzenia domowych wydatków i przychodów. Stworzona z myślą o wspólnym zarządzaniu finansami przez pary/rodziny.

![React](https://img.shields.io/badge/React-19-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-38B2AC)
![Google Sheets](https://img.shields.io/badge/Backend-Google%20Sheets-green)

## ✨ Funkcjonalności

- 📊 **Dashboard** — podsumowanie miesiąca (przychody, wydatki, bilans)
- ➕ **Dodawanie transakcji** — z kategorią, podkategorią, osobą i komentarzem
- 📅 **Nawigacja miesięczna** — przeglądanie różnych miesięcy
- 🗑️ **Usuwanie transakcji**
- 👥 **Wieloosobowe** — oznaczanie kto wprowadził transakcję
- ☁️ **Synchronizacja** — dane w Google Sheets, dostępne z każdego urządzenia

## 🛠️ Stack technologiczny

- **Frontend:** React 19 + Vite
- **Stylowanie:** Tailwind CSS 4
- **Backend:** Google Sheets + Google Apps Script
- **Hosting:** Netlify / Vercel (opcjonalnie)

## 📋 Wymagania

- Node.js 18+
- Konto Google (do arkusza)

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

### 3. Skonfiguruj backend (Google Sheets)

Szczegółowa instrukcja: [SETUP_GOOGLE.md](./docs/SETUP_GOOGLE.md)

Krótko:
1. Utwórz nowy arkusz Google
2. Wklej skrypt Apps Script z pliku `google-apps-script/Code.gs`
3. Wdróż jako aplikację internetową
4. Skopiuj URL i wklej do `src/App.jsx` (zmienna `API_URL`)

### 4. Uruchom lokalnie

```bash
npm run dev
```

Aplikacja będzie dostępna pod adresem: `http://localhost:5173`

## 📁 Struktura projektu

```
budzet-domowy/
├── src/
│   ├── App.jsx          # Główna aplikacja React
│   ├── main.jsx         # Punkt wejścia
│   └── index.css        # Style Tailwind
├── google-apps-script/
│   └── Code.gs          # Skrypt Google Apps Script
├── docs/
│   └── SETUP_GOOGLE.md  # Instrukcja konfiguracji Google
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## 📊 Struktura danych w arkuszu

Aplikacja tworzy 3 zakładki:

### Transakcje
| ID | Data | Typ | Kwota | Kategoria | Podkategoria | Osoba | Komentarz |
|----|------|-----|-------|-----------|--------------|-------|-----------|

### Kategorie
| Typ | Kategoria | Podkategoria |
|-----|-----------|--------------|

### Osoby
| Osoba |
|-------|

## 🔧 Konfiguracja

### Zmiana URL API

W pliku `src/App.jsx` zmień wartość:

```javascript
const API_URL = 'https://script.google.com/macros/s/TWOJ_KLUCZ/exec';
```

### Domyślne kategorie

Kategorie są definiowane w skrypcie Google Apps Script w funkcji `initializeSpreadsheet()`. Możesz je edytować bezpośrednio w arkuszu Google lub zmodyfikować skrypt.

## 🚢 Deployment

### Netlify

1. Zbuduj aplikację:
```bash
npm run build
```

2. Przeciągnij folder `dist` na [netlify.com](https://netlify.com)

### Vercel

1. Połącz repozytorium GitHub z [vercel.com](https://vercel.com)
2. Vercel automatycznie wykryje Vite i skonfiguruje build

## 🗺️ Roadmap

- [x] MVP — dodawanie/usuwanie transakcji
- [x] Podsumowanie miesiąca
- [x] Optymalizacja ładowania danych
- [ ] Widok kategorii z wykresami
- [ ] Edycja transakcji
- [ ] Zarządzanie słownikami w aplikacji
- [ ] Import CSV z banku
- [ ] Budżetowanie (plan vs realizacja)

## 🤝 Współtworzenie

Pull requesty są mile widziane! Przy większych zmianach proszę najpierw otworzyć issue.

## 📄 Licencja

MIT
