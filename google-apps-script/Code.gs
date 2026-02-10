// ============================================
// KONFIGURACJA
// ============================================
const SPREADSHEET_ID = 'TUTAJ_WKLEJ_ID_ARKUSZA';

// ============================================
// AUTENTYKACJA - Google OAuth Token Verification
// Weryfikacja JWT lokalna — nie wymaga UrlFetchApp ani dodatkowych uprawnień.
// ============================================

/**
 * Dekoduje Base64URL string (używany w JWT).
 */
function base64UrlDecode(str) {
  // Zamień Base64URL na zwykły Base64
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  // Dodaj padding
  while (str.length % 4 !== 0) {
    str += '=';
  }
  return Utilities.newBlob(Utilities.base64Decode(str)).getDataAsString();
}

/**
 * Weryfikuje Google ID token lokalnie (dekoduje JWT i sprawdza claims).
 * Nie wymaga UrlFetchApp — działa bez script.external_request.
 *
 * Sprawdza: format JWT, issuer, expiration, obecność email.
 * Opcjonalnie sprawdza audience jeśli GOOGLE_CLIENT_ID jest ustawiony w Script Properties.
 */
function verifyGoogleToken(idToken) {
  if (!idToken) {
    return { valid: false, error: 'Brak tokena autoryzacji' };
  }

  try {
    // Rozdziel JWT na części
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Nieprawidłowy format tokena' };
    }

    // Dekoduj payload
    const payload = JSON.parse(base64UrlDecode(parts[1]));

    // Sprawdź issuer
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!validIssuers.includes(payload.iss)) {
      return { valid: false, error: 'Nieprawidłowy wystawca tokena' };
    }

    // Sprawdź expiration
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || Number(payload.exp) < now) {
      return { valid: false, error: 'Token wygasł — zaloguj się ponownie' };
    }

    // Sprawdź email
    if (!payload.email) {
      return { valid: false, error: 'Token nie zawiera adresu email' };
    }

    // Opcjonalnie: sprawdź audience (client ID)
    const props = PropertiesService.getScriptProperties();
    const expectedClientId = props.getProperty('GOOGLE_CLIENT_ID');
    if (expectedClientId && expectedClientId.trim() !== '') {
      if (payload.aud !== expectedClientId.trim()) {
        return { valid: false, error: 'Token nie jest przeznaczony dla tej aplikacji' };
      }
    }

    return {
      valid: true,
      email: payload.email,
      name: payload.name || payload.email,
    };
  } catch (err) {
    return { valid: false, error: 'Błąd weryfikacji tokena: ' + err.toString() };
  }
}

/**
 * Sprawdza czy email jest na whitelist (jeśli whitelist jest skonfigurowany).
 * Whitelist jest przechowywany w Script Properties pod kluczem ALLOWED_EMAILS
 * jako lista email oddzielona przecinkami, np.: "jan@gmail.com,anna@gmail.com"
 *
 * Jeśli ALLOWED_EMAILS nie jest ustawiony — wszyscy zalogowani użytkownicy mają dostęp.
 */
function isEmailAllowed(email) {
  const props = PropertiesService.getScriptProperties();
  const allowedEmails = props.getProperty('ALLOWED_EMAILS');

  // Jeśli whitelist nie jest skonfigurowany, każdy zalogowany użytkownik ma dostęp
  if (!allowedEmails || allowedEmails.trim() === '') {
    return true;
  }

  const emailList = allowedEmails.split(',').map(e => e.trim().toLowerCase());
  return emailList.includes(email.toLowerCase());
}

/**
 * Autoryzuje request — weryfikuje token i sprawdza whitelist.
 * Zwraca {authorized: true, user} lub {authorized: false, error}.
 */
function authorizeRequest(token) {
  const verification = verifyGoogleToken(token);
  if (!verification.valid) {
    return { authorized: false, error: verification.error };
  }

  if (!isEmailAllowed(verification.email)) {
    return { authorized: false, error: 'Brak dostępu — Twoje konto nie jest na liście autoryzowanych użytkowników' };
  }

  return { authorized: true, user: verification };
}

// ============================================
// ZARZĄDZANIE WHITELIST
// ============================================

/**
 * Ustawia listę dozwolonych email-i.
 * Uruchom tę funkcję ręcznie w edytorze Apps Script (Run > setupAllowedEmails).
 *
 * Zmień poniższą listę na swoje email-e, a potem kliknij "Run".
 */
function setupAllowedEmails() {
  const emails = [
    'twoj-email@gmail.com',
    'drugi-email@gmail.com'
  ];

  PropertiesService.getScriptProperties().setProperty(
    'ALLOWED_EMAILS',
    emails.join(',')
  );

  Logger.log('Whitelist ustawiony: ' + emails.join(', '));
}

/**
 * Wyświetla aktualną listę dozwolonych email-i.
 * Uruchom: Run > showAllowedEmails, potem sprawdź Logs.
 */
function showAllowedEmails() {
  const emails = PropertiesService.getScriptProperties().getProperty('ALLOWED_EMAILS');
  Logger.log('Aktualny whitelist: ' + (emails || '(brak — wszyscy mają dostęp)'));
}

/**
 * Usuwa whitelist — wszyscy zalogowani użytkownicy będą mieli dostęp.
 */
function clearAllowedEmails() {
  PropertiesService.getScriptProperties().deleteProperty('ALLOWED_EMAILS');
  Logger.log('Whitelist usunięty — wszyscy zalogowani użytkownicy mają dostęp');
}

// ============================================
// INICJALIZACJA ARKUSZA
// ============================================
function initializeSpreadsheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Zakładka: Transakcje
  let transakcje = ss.getSheetByName('Transakcje');
  if (!transakcje) {
    transakcje = ss.insertSheet('Transakcje');
    transakcje.getRange('A1:H1').setValues([[
      'ID', 'Data', 'Typ', 'Kwota', 'Kategoria', 'Podkategoria', 'Osoba', 'Komentarz'
    ]]);
    transakcje.getRange('A1:H1').setFontWeight('bold');
    transakcje.setFrozenRows(1);
  }
  
  // Zakładka: Kategorie
  let kategorie = ss.getSheetByName('Kategorie');
  if (!kategorie) {
    kategorie = ss.insertSheet('Kategorie');
    kategorie.getRange('A1:C1').setValues([['Typ', 'Kategoria', 'Podkategoria']]);
    kategorie.getRange('A1:C1').setFontWeight('bold');
    kategorie.setFrozenRows(1);
    
    // Domyślne kategorie
    const domyslneKategorie = [
      // Wydatki stałe
      ['Wydatek', 'Mieszkanie', 'Czynsz'],
      ['Wydatek', 'Mieszkanie', 'Prąd'],
      ['Wydatek', 'Mieszkanie', 'Gaz'],
      ['Wydatek', 'Mieszkanie', 'Woda'],
      ['Wydatek', 'Mieszkanie', 'Internet'],
      ['Wydatek', 'Mieszkanie', 'Telefon'],
      ['Wydatek', 'Mieszkanie', 'Ubezpieczenie mieszkania'],
      
      ['Wydatek', 'Dzieci', 'Przedszkole/Szkoła'],
      ['Wydatek', 'Dzieci', 'Zajęcia dodatkowe'],
      ['Wydatek', 'Dzieci', 'Ubrania dzieci'],
      ['Wydatek', 'Dzieci', 'Zabawki/książki'],
      ['Wydatek', 'Dzieci', 'Lekarz/leki dzieci'],
      
      ['Wydatek', 'Transport', 'Paliwo'],
      ['Wydatek', 'Transport', 'Ubezpieczenie auta'],
      ['Wydatek', 'Transport', 'Serwis/naprawy'],
      ['Wydatek', 'Transport', 'Komunikacja miejska'],
      ['Wydatek', 'Transport', 'Parking'],
      
      ['Wydatek', 'Kredyty/Raty', 'Kredyt hipoteczny'],
      ['Wydatek', 'Kredyty/Raty', 'Kredyt gotówkowy'],
      ['Wydatek', 'Kredyty/Raty', 'Raty'],
      
      // Wydatki zmienne
      ['Wydatek', 'Jedzenie', 'Zakupy domowe'],
      ['Wydatek', 'Jedzenie', 'Restauracje/miasto'],
      ['Wydatek', 'Jedzenie', 'Praca (lunch)'],
      ['Wydatek', 'Jedzenie', 'Kawa/przekąski'],
      
      ['Wydatek', 'Zdrowie', 'Lekarz'],
      ['Wydatek', 'Zdrowie', 'Leki'],
      ['Wydatek', 'Zdrowie', 'Suplementy'],
      
      ['Wydatek', 'Rozrywka', 'Kino/koncerty'],
      ['Wydatek', 'Rozrywka', 'Subskrypcje'],
      ['Wydatek', 'Rozrywka', 'Hobby'],
      ['Wydatek', 'Rozrywka', 'Wyjazdy/wakacje'],
      
      ['Wydatek', 'Dom', 'Wyposażenie'],
      ['Wydatek', 'Dom', 'Chemia/środki czystości'],
      ['Wydatek', 'Dom', 'Naprawy'],
      ['Wydatek', 'Dom', 'Ogród'],
      
      ['Wydatek', 'Ubrania', 'Dorośli'],
      
      ['Wydatek', 'Inne', 'Prezenty'],
      ['Wydatek', 'Inne', 'Fryzjer/kosmetyki'],
      ['Wydatek', 'Inne', 'Nieprzewidziane'],
      
      // Przychody
      ['Przychód', 'Wynagrodzenie', 'Mąż'],
      ['Przychód', 'Wynagrodzenie', 'Żona'],
      ['Przychód', 'Inne przychody', '800+'],
      ['Przychód', 'Inne przychody', 'Zwroty'],
      ['Przychód', 'Inne przychody', 'Premia'],
      ['Przychód', 'Inne przychody', 'Sprzedaż rzeczy']
    ];
    
    kategorie.getRange(2, 1, domyslneKategorie.length, 3).setValues(domyslneKategorie);
  }
  
  // Zakładka: Osoby
  let osoby = ss.getSheetByName('Osoby');
  if (!osoby) {
    osoby = ss.insertSheet('Osoby');
    osoby.getRange('A1').setValue('Osoba');
    osoby.getRange('A1').setFontWeight('bold');
    osoby.setFrozenRows(1);
    osoby.getRange('A2:A3').setValues([['Mąż'], ['Żona']]);
  }

  // Zakładka: Budżety
  let budzety = ss.getSheetByName('Budżety');
  if (!budzety) {
    budzety = ss.insertSheet('Budżety');
    budzety.getRange('A1:H1').setValues([[
      'Kategoria', 'Osoba', 'Zakres', 'Rok', 'Miesiąc', 'Limit', 'Notatki', 'Utworzono'
    ]]);
    budzety.getRange('A1:H1').setFontWeight('bold');
    budzety.setFrozenRows(1);
  }
  
  return 'Arkusz zainicjalizowany pomyślnie!';
}

// ============================================
// OBSŁUGA ŻĄDAŃ HTTP
// ============================================
function doGet(e) {
  const action = e.parameter.action;
  let result;

  // Autoryzacja — sprawdź token (init nie wymaga autoryzacji)
  if (action !== 'init') {
    const auth = authorizeRequest(e.parameter.token);
    if (!auth.authorized) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: auth.error, unauthorized: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  try {
    switch(action) {
      case 'getTransakcje':
        result = getTransakcje(e.parameter.miesiac, e.parameter.rok);
        break;
      case 'getBudgets':
        result = getBudgets(e.parameter.miesiac, e.parameter.rok);
        break;
      case 'getYearlyBudgets':
        result = getYearlyBudgets(e.parameter.rok);
        break;
      case 'getMonthlyBudgets':
        result = getMonthlyBudgets(e.parameter.miesiac, e.parameter.rok);
        break;
      case 'getKategorie':
        result = getKategorie();
        break;
      case 'getOsoby':
        result = getOsoby();
        break;
      case 'getAllData':
        result = getAllData(e.parameter.miesiac, e.parameter.rok);
        break;
      case 'init':
        result = initializeSpreadsheet();
        break;
      default:
        result = {error: 'Nieznana akcja'};
    }
  } catch(error) {
    result = {error: error.toString()};
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  let result;

  // Autoryzacja — sprawdź token
  const auth = authorizeRequest(data.token);
  if (!auth.authorized) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: auth.error, unauthorized: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    switch(action) {
      // Read actions (moved from doGet to avoid token-in-URL length issues)
      case 'getTransakcje':
        result = getTransakcje(data.miesiac, data.rok);
        break;
      case 'getBudgets':
        result = getBudgets(data.miesiac, data.rok);
        break;
      case 'getYearlyBudgets':
        result = getYearlyBudgets(data.rok);
        break;
      case 'getMonthlyBudgets':
        result = getMonthlyBudgets(data.miesiac, data.rok);
        break;
      case 'getKategorie':
        result = getKategorie();
        break;
      case 'getOsoby':
        result = getOsoby();
        break;
      case 'getAllData':
        result = getAllData(data.miesiac, data.rok);
        break;
      // Write actions
      case 'addTransakcja':
        result = addTransakcja(data.transakcja);
        break;
      case 'addTransakcjeBatch':
        result = addTransakcjeBatch(data.transakcje);
        break;
      case 'updateTransakcja':
        result = updateTransakcja(data.id, data.transakcja);
        break;
      case 'deleteTransakcja':
        result = deleteTransakcja(data.id);
        break;
      case 'addKategoria':
        result = addKategoria(data.typ, data.kategoria, data.podkategoria);
        break;
      case 'deleteKategoria':
        result = deleteKategoria(data.typ, data.kategoria, data.podkategoria);
        break;
      case 'addOsoba':
        result = addOsoba(data.osoba);
        break;
      case 'deleteOsoba':
        result = deleteOsoba(data.osoba);
        break;
      case 'setBudget':
        result = setBudget(data.budget);
        break;
      case 'deleteBudget':
        result = deleteBudget(data.budget);
        break;
      default:
        result = {error: 'Nieznana akcja'};
    }
  } catch(error) {
    result = {error: error.toString()};
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// POBIERZ WSZYSTKIE DANE (OPTYMALIZACJA)
// ============================================
function getAllData(miesiac, rok) {
  return {
    transakcje: getTransakcje(miesiac, rok),
    kategorie: getKategorie(),
    osoby: getOsoby()
  };
}

// ============================================
// WALIDACJA DANYCH TRANSAKCJI
// ============================================
/**
 * Waliduje dane transakcji
 * Zwraca {valid: true} lub {valid: false, error: "komunikat błędu"}
 */
function validateTransaction(transakcja) {
  // Waliduj typ
  if (!transakcja.typ) {
    return { valid: false, error: 'Typ transakcji jest wymagany' };
  }
  
  if (!['Wydatek', 'Przychód'].includes(transakcja.typ)) {
    return { valid: false, error: 'Typ musi być "Wydatek" lub "Przychód"' };
  }
  
  // Waliduj datę
  if (!transakcja.data) {
    return { valid: false, error: 'Data jest wymagana' };
  }
  
  if (typeof transakcja.data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(transakcja.data)) {
    return { valid: false, error: 'Data musi być w formacie YYYY-MM-DD' };
  }
  
  // Sprawdź czy data jest prawidłowa
  const dateParts = transakcja.data.split('-').map(Number);
  const [year, month, day] = dateParts;
  const date = new Date(year, month - 1, day);
  
  // Sprawdź czy data jest rzeczywista (np. 31 luty nie istnieje)
  if (date.getFullYear() !== year || 
      date.getMonth() !== month - 1 || 
      date.getDate() !== day) {
    return { valid: false, error: 'Data nie jest prawidłowa' };
  }
  
  // Waliduj kwotę
  if (transakcja.kwota === undefined || transakcja.kwota === null || transakcja.kwota === '') {
    return { valid: false, error: 'Kwota jest wymagana' };
  }
  
  const kwota = Number(transakcja.kwota);
  
  if (isNaN(kwota)) {
    return { valid: false, error: 'Kwota musi być liczbą' };
  }
  
  if (kwota === 0 || isNaN(kwota)) {
    return { valid: false, error: 'Kwota musi być różna od 0 i numeryczna' };
  }
  
  // Waliduj kategorię
  if (!transakcja.kategoria || transakcja.kategoria.trim() === '') {
    return { valid: false, error: 'Kategoria jest wymagana' };
  }
  
  return { valid: true };
}

// ============================================
// POMOCNICZE FUNKCJE DO PARSOWANIA DAT
// ============================================
/**
 * Parsuje datę z formatu YYYY-MM-DD na Date obiektu
 * Unika problemu z new Date() który może interpretować daty różnie
 */
function parseDateString(dateString) {
  if (!dateString) return null;
  
  // Sprawdzaj czy to string w formacie YYYY-MM-DD
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // Jeśli to Data obiektu, zwróć ją
  if (dateString instanceof Date) {
    return dateString;
  }
  
  // W ostateczności spróbuj new Date
  return new Date(dateString);
}

/**
 * Formatuje datę jako YYYY-MM-DD w strefie czasowej Europe/Warsaw
 */
function formatDateToString(date, timezone = 'Europe/Warsaw') {
  if (!date) return '';
  
  // Jeśli to string w formacie YYYY-MM-DD, zwróć jako jest
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  
  // Skonwertuj na Date jeśli to string
  if (typeof date === 'string') {
    date = parseDateString(date);
  }
  
  // Formatuj używając Utilities.formatDate w Europe/Warsaw
  return Utilities.formatDate(date, timezone, 'yyyy-MM-dd');
}

// ============================================
// TRANSAKCJE
// ============================================
function getTransakcje(miesiac, rok) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Transakcje');
  const data = sheet.getDataRange().getValues();
  
  const transakcje = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    
    // Parsuj datę prawidłowo - unikaj błędów ze strefą czasową
    const dateString = row[1];
    const dataParsed = parseDateString(dateString);
    
    // Filtuj po miesiącu i roku jeśli podane
    // Użyj Utilities.formatDate aby uniknąć problemów ze strefą czasową
    if (miesiac && rok) {
      const formattedDate = Utilities.formatDate(dataParsed, 'Europe/Warsaw', 'yyyy-MM-dd');
      const [year, month, day] = formattedDate.split('-').map(Number);
      
      if (Number(month) !== Number(miesiac) || Number(year) !== Number(rok)) {
        continue;
      }
    }
    
    // Zwróć datę sformatowaną jako YYYY-MM-DD w Europe/Warsaw
    const formattedDate = formatDateToString(dataParsed, 'Europe/Warsaw');
    
    transakcje.push({
      id: row[0],
      data: formattedDate,
      typ: row[2],
      kwota: row[3],
      kategoria: row[4],
      podkategoria: row[5],
      osoba: row[6],
      komentarz: row[7]
    });
  }
  
  return transakcje;
}

function addTransakcja(transakcja) {
  // Waliduj dane wejściowe
  const validation = validateTransaction(transakcja);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Transakcje');
  
  // Normalizuj kwotę - przechowuj wartość bezwzględną
  // Typ określa czy to wydatek czy przychód
  const kwotaNum = Number(transakcja.kwota);
  const kwotaBezWartosc = Math.abs(kwotaNum);
  
  const id = Utilities.getUuid();
  sheet.appendRow([
    id,
    transakcja.data,
    transakcja.typ,
    kwotaBezWartosc,
    transakcja.kategoria,
    transakcja.podkategoria || '',
    transakcja.osoba || '',
    transakcja.komentarz || ''
  ]);
  
  return { success: true, id: id, message: 'Transakcja została dodana pomyślnie' };
}

function addTransakcjeBatch(transakcje) {
  // Waliduj czy to tablica
  if (!Array.isArray(transakcje)) {
    return { success: false, error: 'Transakcje muszą być w formacie tablicy' };
  }
  
  if (transakcje.length === 0) {
    return { success: false, error: 'Brak transakcji do importu' };
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Transakcje');
  
  const rows = [];
  const successIds = [];
  const errors = [];
  
  // Waliduj i przygotuj wszystkie wiersze
  for (let i = 0; i < transakcje.length; i++) {
    const transakcja = transakcje[i];
    
    // Waliduj dane
    const validation = validateTransaction(transakcja);
    if (!validation.valid) {
      errors.push({ index: i, error: validation.error });
      continue;
    }
    
    // Normalizuj kwotę - przechowuj wartość bezwzględną
    // Typ określa czy to wydatek czy przychód
    const kwotaNum = Number(transakcja.kwota);
    const kwotaBezWartosc = Math.abs(kwotaNum);
    
    const id = Utilities.getUuid();
    rows.push([
      id,
      transakcja.data,
      transakcja.typ,
      kwotaBezWartosc,
      transakcja.kategoria,
      transakcja.podkategoria || '',
      transakcja.osoba || '',
      transakcja.komentarz || ''
    ]);
    
    successIds.push(id);
  }
  
  // Jeśli są błędy i żadne transakcje nie przeszły walidacji
  if (rows.length === 0) {
    return { 
      success: false, 
      error: `Brak ważnych transakcji do importu. Błędy: ${errors.map(e => `Wiersz ${e.index + 1}: ${e.error}`).join('; ')}`
    };
  }
  
  // Dodaj wszystkie prawidłowe wiersze naraz (batch insert)
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
  
  return {
    success: true,
    count: rows.length,
    ids: successIds,
    message: `Zaimportowano ${rows.length} transakcji${errors.length > 0 ? `. Pominięto ${errors.length} transakcji z błędami.` : '.'}`
  };
}

function updateTransakcja(id, transakcja) {
  // Waliduj dane wejściowe
  const validation = validateTransaction(transakcja);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Transakcje');
  const data = sheet.getDataRange().getValues();
  
  // Normalizuj kwotę - przechowuj wartość bezwzględną
  const kwotaNum = Number(transakcja.kwota);
  const kwotaBezWartosc = Math.abs(kwotaNum);
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 2, 1, 7).setValues([[
        transakcja.data,
        transakcja.typ,
        kwotaBezWartosc,
        transakcja.kategoria,
        transakcja.podkategoria || '',
        transakcja.osoba || '',
        transakcja.komentarz || ''
      ]]);
      return { success: true, message: 'Transakcja została zaktualizowana pomyślnie' };
    }
  }
  
  return { success: false, error: 'Nie znaleziono transakcji o podanym ID' };
}

function deleteTransakcja(id) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Transakcje');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return {success: true};
    }
  }
  
  return {error: 'Nie znaleziono transakcji'};
}

// ============================================
// KATEGORIE
// ============================================
function getKategorie() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Kategorie');
  const data = sheet.getDataRange().getValues();
  
  const kategorie = {
    'Wydatek': {},
    'Przychód': {}
  };
  
  for (let i = 1; i < data.length; i++) {
    const [typ, kategoria, podkategoria] = data[i];
    if (!typ || !kategoria) continue;
    
    if (!kategorie[typ]) kategorie[typ] = {};
    if (!kategorie[typ][kategoria]) kategorie[typ][kategoria] = [];
    if (podkategoria) {
      kategorie[typ][kategoria].push(podkategoria);
    }
  }
  
  return kategorie;
}

function addKategoria(typ, kategoria, podkategoria) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Kategorie');
  
  sheet.appendRow([typ, kategoria, podkategoria || '']);
  return {success: true};
}

function deleteKategoria(typ, kategoria, podkategoria) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Kategorie');
  const data = sheet.getDataRange().getValues();
  
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === typ && data[i][1] === kategoria && 
        (podkategoria ? data[i][2] === podkategoria : true)) {
      sheet.deleteRow(i + 1);
      if (podkategoria) return {success: true};
    }
  }
  
  return {success: true};
}

// ============================================
// OSOBY
// ============================================
function getOsoby() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Osoby');
  const data = sheet.getDataRange().getValues();
  
  const osoby = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) osoby.push(data[i][0]);
  }
  
  return osoby;
}

function addOsoba(osoba) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Osoby');
  
  sheet.appendRow([osoba]);
  return {success: true};
}

function deleteOsoba(osoba) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Osoby');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === osoba) {
      sheet.deleteRow(i + 1);
      return {success: true};
    }
  }
  
  return {error: 'Nie znaleziono osoby'};
}

// ============================================
// BUDŻETY
// Format nowego arkusza "Budżety":
// Kategoria | Osoba | Zakres | Rok | Miesiąc | Limit | Notatki | Utworzono
// Kompatybilność wsteczna: stary format (Kategoria | Limit | Miesiąc | Rok)
// ============================================
function normalizeBudgetScope(scope) {
  return scope === 'yearly' ? 'yearly' : 'monthly';
}

function normalizeBudgetSheet(sheet) {
  const data = sheet.getDataRange().getValues();
  if (!data.length) {
    sheet.getRange('A1:H1').setValues([[
      'Kategoria', 'Osoba', 'Zakres', 'Rok', 'Miesiąc', 'Limit', 'Notatki', 'Utworzono'
    ]]);
    sheet.getRange('A1:H1').setFontWeight('bold');
    sheet.setFrozenRows(1);
    return;
  }

  const header = data[0] || [];
  const isNewFormat =
    header[0] === 'Kategoria' &&
    header[1] === 'Osoba' &&
    header[2] === 'Zakres' &&
    header[3] === 'Rok';

  if (isNewFormat) return;

  const migrated = [[
    'Kategoria', 'Osoba', 'Zakres', 'Rok', 'Miesiąc', 'Limit', 'Notatki', 'Utworzono'
  ]];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    migrated.push([
      row[0],
      'Wszyscy',
      'monthly',
      row[3] ? Number(row[3]) : '',
      row[2] ? Number(row[2]) : '',
      Number(row[1]) || 0,
      '',
      new Date()
    ]);
  }

  sheet.clearContents();
  sheet.getRange(1, 1, migrated.length, 8).setValues(migrated);
  sheet.getRange('A1:H1').setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function parseBudgetRows(data) {
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;

    const scope = normalizeBudgetScope((row[2] || '').toString().trim());
    const year = row[3] ? Number(row[3]) : null;
    const month = row[4] ? Number(row[4]) : null;

    rows.push({
      rowIndex: i + 1,
      kategoria: row[0],
      osoba: row[1] || 'Wszyscy',
      scope,
      rok: year,
      miesiac: scope === 'monthly' ? month : null,
      limit: Number(row[5]) || 0,
      notes: row[6] || ''
    });
  }

  return rows;
}

function getBudgetLookupKey(kategoria, osoba) {
  return [kategoria, osoba || 'Wszyscy'].join('||');
}

function getBudgets(miesiac, rok) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Budżety');
  if (!sheet) return [];

  normalizeBudgetSheet(sheet);
  const rows = parseBudgetRows(sheet.getDataRange().getValues());

  const targetMonth = miesiac ? Number(miesiac) : null;
  const targetYear = rok ? Number(rok) : null;

  const yearlyMap = {};
  const monthlyMap = {};

  rows.forEach((budget) => {
    if (targetYear && budget.rok !== targetYear) return;

    const key = getBudgetLookupKey(budget.kategoria, budget.osoba);

    if (budget.scope === 'yearly') {
      yearlyMap[key] = budget;
      return;
    }

    if (budget.scope === 'monthly') {
      if (targetMonth && budget.miesiac !== targetMonth) return;
      monthlyMap[key] = budget;
    }
  });

  const keys = {};
  Object.keys(yearlyMap).forEach(k => keys[k] = true);
  Object.keys(monthlyMap).forEach(k => keys[k] = true);

  return Object.keys(keys).map((key) => {
    const monthly = monthlyMap[key] || null;
    const yearly = yearlyMap[key] || null;
    const active = monthly || yearly;

    return {
      kategoria: active.kategoria,
      osoba: active.osoba,
      limit: active.limit,
      miesiac: targetMonth,
      rok: targetYear,
      scope: active.scope,
      source: monthly ? 'monthly' : 'yearly',
      monthlyBudget: monthly,
      yearlyBudget: yearly,
      isOverride: Boolean(monthly && yearly)
    };
  });
}

function getYearlyBudgets(rok) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Budżety');
  if (!sheet) return [];

  normalizeBudgetSheet(sheet);
  const rows = parseBudgetRows(sheet.getDataRange().getValues());
  const targetYear = rok ? Number(rok) : null;

  return rows.filter((budget) => budget.scope === 'yearly' && (!targetYear || budget.rok === targetYear));
}

function getMonthlyBudgets(miesiac, rok) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Budżety');
  if (!sheet) return [];

  normalizeBudgetSheet(sheet);
  const rows = parseBudgetRows(sheet.getDataRange().getValues());
  const targetMonth = miesiac ? Number(miesiac) : null;
  const targetYear = rok ? Number(rok) : null;

  return rows.filter((budget) => {
    if (budget.scope !== 'monthly') return false;
    if (targetYear && budget.rok !== targetYear) return false;
    if (targetMonth && budget.miesiac !== targetMonth) return false;
    return true;
  });
}

function setBudget(budget) {
  if (!budget || !budget.kategoria) return { success: false, error: 'Brak danych budżetu' };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Budżety');
  if (!sheet) return { success: false, error: 'Arkusz Budżety nie istnieje' };

  normalizeBudgetSheet(sheet);

  const data = sheet.getDataRange().getValues();
  const scope = normalizeBudgetScope((budget.scope || '').toString().trim());
  const targetYear = budget.rok ? Number(budget.rok) : null;
  const targetMonth = scope === 'monthly' && budget.miesiac ? Number(budget.miesiac) : null;
  const limit = Number(budget.limit) || 0;
  const osoba = budget.osoba || 'Wszyscy';
  const notes = budget.notes || '';

  if (!targetYear) {
    return { success: false, error: 'Rok jest wymagany' };
  }
  if (scope === 'monthly' && (!targetMonth || targetMonth < 1 || targetMonth > 12)) {
    return { success: false, error: 'Dla budżetu miesięcznego wymagany jest miesiąc 1-12' };
  }

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowCat = row[0];
    const rowOsoba = row[1] || 'Wszyscy';
    const rowScope = normalizeBudgetScope((row[2] || '').toString().trim());
    const rowYear = row[3] ? Number(row[3]) : null;
    const rowMonth = row[4] ? Number(row[4]) : null;

    const matches =
      rowCat === budget.kategoria &&
      rowOsoba === osoba &&
      rowScope === scope &&
      rowYear === targetYear &&
      (scope === 'yearly' || rowMonth === targetMonth);

    if (matches) {
      sheet.getRange(i + 1, 6).setValue(limit);
      sheet.getRange(i + 1, 7).setValue(notes);
      return { success: true, message: 'Zaktualizowano budżet' };
    }
  }

  sheet.appendRow([
    budget.kategoria,
    osoba,
    scope,
    targetYear,
    scope === 'monthly' ? targetMonth : '',
    limit,
    notes,
    new Date()
  ]);

  return { success: true, message: 'Dodano budżet' };
}

function deleteBudget(budget) {
  if (!budget || !budget.kategoria) return { success: false, error: 'Brak danych budżetu do usunięcia' };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Budżety');
  if (!sheet) return { success: false, error: 'Arkusz Budżety nie istnieje' };

  normalizeBudgetSheet(sheet);

  const scope = normalizeBudgetScope((budget.scope || '').toString().trim());
  const targetYear = budget.rok ? Number(budget.rok) : null;
  const targetMonth = scope === 'monthly' && budget.miesiac ? Number(budget.miesiac) : null;
  const osoba = budget.osoba || 'Wszyscy';

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowScope = normalizeBudgetScope((row[2] || '').toString().trim());
    const rowMonth = row[4] ? Number(row[4]) : null;
    const rowYear = row[3] ? Number(row[3]) : null;
    const rowOsoba = row[1] || 'Wszyscy';

    const matches =
      row[0] === budget.kategoria &&
      rowOsoba === osoba &&
      rowScope === scope &&
      rowYear === targetYear &&
      (scope === 'yearly' || rowMonth === targetMonth);

    if (matches) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Usunięto budżet' };
    }
  }

  return { success: false, error: 'Nie znaleziono budżetu do usunięcia' };
}
