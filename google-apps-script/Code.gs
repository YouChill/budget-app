// ============================================
// KONFIGURACJA
// ============================================
const SPREADSHEET_ID = 'TUTAJ_WKLEJ_ID_ARKUSZA';

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
  
  return 'Arkusz zainicjalizowany pomyślnie!';
}

// ============================================
// OBSŁUGA ŻĄDAŃ HTTP
// ============================================
function doGet(e) {
  const action = e.parameter.action;
  let result;
  
  try {
    switch(action) {
      case 'getTransakcje':
        result = getTransakcje(e.parameter.miesiac, e.parameter.rok);
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
  
  try {
    switch(action) {
      case 'addTransakcja':
        result = addTransakcja(data.transakcja);
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
    
    const dataTransakcji = new Date(row[1]);
    
    // Filtrowanie po miesiącu i roku jeśli podane
    if (miesiac && rok) {
      if (dataTransakcji.getMonth() + 1 != miesiac || dataTransakcji.getFullYear() != rok) {
        continue;
      }
    }
    
    transakcje.push({
      id: row[0],
      data: row[1],
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Transakcje');
  
  const id = Utilities.getUuid();
  sheet.appendRow([
    id,
    transakcja.data,
    transakcja.typ,
    transakcja.kwota,
    transakcja.kategoria,
    transakcja.podkategoria,
    transakcja.osoba,
    transakcja.komentarz || ''
  ]);
  
  return {success: true, id: id};
}

function updateTransakcja(id, transakcja) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Transakcje');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 2, 1, 7).setValues([[
        transakcja.data,
        transakcja.typ,
        transakcja.kwota,
        transakcja.kategoria,
        transakcja.podkategoria,
        transakcja.osoba,
        transakcja.komentarz || ''
      ]]);
      return {success: true};
    }
  }
  
  return {error: 'Nie znaleziono transakcji'};
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
