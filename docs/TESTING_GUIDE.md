# Testy - Instrukcja dla Developerów

## Szybki start

```bash
# Instalacja zale\u017cno\u015bci (je\u015bli nie zainstalowano)
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

# Uruchomienie testów w trybie watch
npm test

# Jednorazowe uruchomienie (dla CI/CD)
npm run test:run
```

## Struktura testów

```
src/
├── test/                          # Konfiguracja i mocki
│   ├── setup.js                   # Setup Testing Library + jest-dom
│   └── mocks/
│       └── supabase.js            # Mock Supabase SDK
│
├── utils/
│   └── calculations.js            # Logika biznesowa (formatowanie, obliczenia, daty)
│
├── services/
│   └── __tests__/
│       └── api.test.js            # Testy warstwy API
│
├── components/
│   ├── TransactionItem.jsx        # Komponet transakcji (testowany)
│   ├── TransactionForm.jsx        # Formularz transakcji (testowany)
│   └── __tests__/
│       └── TransactionItem.test.jsx
│
└── __tests__/
    ├── calculations.test.js       # Testy logiki biznesowej
    └── integration/
        └── budget-flow.test.js    # Testy flow użytkownika
```

## Pisanie nowych testów

### 1. Test jednostkowy (logika)

```javascript
import { describe, it, expect } from 'vitest';
import { calculateBalance } from '../utils/calculations';

describe('calculateBalance', () => {
  it('oblicza bilans poprawnie', () => {
    const transactions = [
      { typ: 'Przychód', kwota: 500 },
      { typ: 'Wydatek', kwota: 100 }
    ];
    
    expect(calculateBalance(transactions)).toBe(400);
  });
});
```

### 2. Test komponentu

```javascript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransactionForm from '../TransactionForm';

describe('TransactionForm', () => {
  it('submituje formularz z poprawnymi danymi', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    
    render(
      <TransactionForm
        kategorie={{ Wydatek: { Jedzenie: [] } }}
        osoby={['Jan']}
        onSubmit={onSubmit}
        onClose={() => {}}
      />
    );
    
    // Wypełnij formularz
    await user.selectOptions(
      screen.getByTestId('field-kategoria'),
      'Jedzenie'
    );
    
    // Sprawdź czy submit został wywołany
    await user.click(screen.getByTestId('button-submit'));
    expect(onSubmit).toHaveBeenCalled();
  });
});
```

### 3. Test integracyjny

```javascript
import { describe, it, expect } from 'vitest';
import {
  calculateIncome,
  calculateBalance,
  sortTransactionsByDate
} from '../utils/calculations';

describe('Workflow: Adding and sorting transactions', () => {
  it('nowa transakcja aktualizuje sumy i sortowanie', () => {
    const before = [
      { data: '2026-02-10', typ: 'Przychód', kwota: 500 }
    ];
    
    const after = [
      ...before,
      { data: '2026-02-15', typ: 'Wydatek', kwota: 100 }
    ];
    
    const sorted = sortTransactionsByDate(after);
    const income = calculateIncome(sorted);
    
    expect(sorted[0].data).toBe('2026-02-15'); // najnowsza
    expect(income).toBe(500); // bez zmian
  });
});
```

## Mocki

### Mock Supabase

Supabase jest mockowany w `src/test/mocks/supabase.js`. Mock zawiera:

```javascript
const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
};

export const supabase = {
  from: vi.fn(() => mockChain),
  // ...
};
```

Aby mockować konkretny scenariusz:

```javascript
const mockChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ 
    data: [{ id: 1, typ: 'Wydatek' }], 
    error: null 
  })
};

supabase.from.mockReturnValue(mockChain);
```

## Best Practices

### ✅ DO (rób tak)

1. **Testuj behawior, nie implementację**
   ```javascript
   // Dobrze - testuje co komponent robi
   expect(screen.getByText('Jedzenie')).toBeInTheDocument();
   ```

2. **Używaj data-testid dla elementów dynamicznych**
   ```javascript
   <input data-testid="field-kwota" />
   
   const field = screen.getByTestId('field-kwota');
   ```

3. **Grupuj testy z `describe`**
   ```javascript
   describe('TransactionForm', () => {
     describe('Validation', () => {
       it('nie submituje z pustymi polami', () => {});
     });
   });
   ```

4. **Testuj edge cases**
   ```javascript
   it('obsługuje puste listy', () => {
     expect(calculateIncome([])).toBe(0);
   });
   ```

### ❌ DON'T (nie rób tak)

1. **Nie testuj implementacji (private methods)**
   ```javascript
   // Źle - testuje internals
   expect(component.state.formData).toEqual({...});
   ```

2. **Nie używaj селectorów CSS**
   ```javascript
   // Źle
   screen.getByText('.form-button');
   
   // Dobrze
   screen.getByTestId('button-submit');
   ```

3. **Nie tworz zbyt dużych testów**
   ```javascript
   // Źle - sprawdza za wiele
   it('pełny flow aplikacji', () => { ... 1000 linii ... });
   
   // Dobrze - jeden test = jeden scenariusz
   it('użytkownik może dodać transakcję', () => { ... });
   ```

4. **Nie ignoruj błędów**
   ```javascript
   // Źle
   vi.mock('module', () => ({ /* ... */ }));
   
   // Dobrze - zawsze czyszczaj
   beforeEach(() => { vi.clearAllMocks(); });
   ```

## Debugging testów

### Wydrukuj HTML komponentu
```javascript
import { screen } from '@testing-library/react';

const { debug } = render(<Component />);
debug(); // wydrukuje HTML w konsoli
```

### Wydrukuj stanu
```javascript
console.log(screen.getByTestId('element').textContent);
```

### Uruchom jeden test
```bash
npm test -- --grep "nazwa testu"
```

### Uruchom pojedynczy plik
```bash
npm test src/__tests__/calculations.test.js
```

## Coverage (pokrycie kodu)

Aby dodać pokrycie kodu w przyszłości:

```bash
npm test -- --coverage
```

Cele:
- Linie: >80%
- Gałęzie: >75%
- Funkcje: >80%
- Instrukcje: >80%

## Troubleshooting

### Problem: "Cannot find module @testing-library/react"
```bash
npm install -D @testing-library/react
```

### Problem: "ReferenceError: global is not defined"
Upewnij się że w `vite.config.js` jest:
```javascript
test: {
  globals: true,
  environment: 'jsdom',
}
```

### Problem: "TypeError: vi is not defined"
Dodaj import:
```javascript
import { vi } from 'vitest';
```

### Problem: Test się wieszą
- Usuń `.only` z innych testów
- Sprawdź mock promises
- Użyj `await waitFor(() => { ... })`

## Zasoby

- [Vitest Docs](https://vitest.dev/)
- [Testing Library](https://testing-library.com/react)
- [RTL Queries](https://testing-library.com/queries)
- [RTL Matchers](https://github.com/testing-library/jest-dom)

## Zmiana logiki biznesowej

Jeśli zmieniasz logikę w `src/utils/calculations.js`:

1. Zaktualizuj testy w `src/__tests__/calculations.test.js`
2. Uruchom `npm test`
3. Upewnij się że testy przechodzą
4. Zaktualizuj komponenty jeśli potrzebne

Przykład:
```javascript
// Zmień logikę
export const calculateIncome = (transakcje = []) => {
  return transakcje
    .filter(t => t.typ === 'Przychód')
    .reduce((sum, t) => sum + (parseFloat(t.kwota) || 0), 0);
};

// Zaktualizuj test
it('poprawnie oblicza przychody', () => {
  const result = calculateIncome([
    { typ: 'Przychód', kwota: 100 },
    { typ: 'Przychód', kwota: 200 }
  ]);
  
  expect(result).toBe(300);
});
```

---

**Ostatnia aktualizacja**: 13 lutego 2026  
**Autor**: System
