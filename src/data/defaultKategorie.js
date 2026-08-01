// Domyślny zestaw kategorii zasiewany dla nowego/pustego gospodarstwa.
// Źródło prawdy: migration/csv/Kategorie.csv — utrzymuj zgodność z tym plikiem.
export const DEFAULT_KATEGORIE = [
  // Wydatki
  { typ: 'Wydatek', kategoria: 'Mieszkanie', podkategoria: 'Czynsz' },
  { typ: 'Wydatek', kategoria: 'Mieszkanie', podkategoria: 'Prąd' },
  { typ: 'Wydatek', kategoria: 'Mieszkanie', podkategoria: 'Gaz' },
  { typ: 'Wydatek', kategoria: 'Mieszkanie', podkategoria: 'Woda' },
  { typ: 'Wydatek', kategoria: 'Mieszkanie', podkategoria: 'Wywóz śmieci' },  // NOWE
  { typ: 'Wydatek', kategoria: 'Mieszkanie', podkategoria: 'Podatki lokalne' },  // NOWE
  { typ: 'Wydatek', kategoria: 'Mieszkanie', podkategoria: 'Internet' },
  { typ: 'Wydatek', kategoria: 'Mieszkanie', podkategoria: 'Telefon' },
  { typ: 'Wydatek', kategoria: 'Mieszkanie', podkategoria: 'Ubezpieczenie mieszkania' },
  { typ: 'Wydatek', kategoria: 'Mieszkanie', podkategoria: 'Ubezpieczenie na życie' },  // NOWE
  { typ: 'Wydatek', kategoria: 'Dzieci', podkategoria: 'Przedszkole/Szkoła' },
  { typ: 'Wydatek', kategoria: 'Dzieci', podkategoria: 'Zajęcia dodatkowe' },
  { typ: 'Wydatek', kategoria: 'Dzieci', podkategoria: 'Ubrania dzieci' },
  { typ: 'Wydatek', kategoria: 'Dzieci', podkategoria: 'Zabawki/książki' },
  { typ: 'Wydatek', kategoria: 'Dzieci', podkategoria: 'Lekarz/leki dzieci' },
  { typ: 'Wydatek', kategoria: 'Dzieci', podkategoria: 'Rehabilitacja' },  // NOWE
  { typ: 'Wydatek', kategoria: 'Transport', podkategoria: 'Paliwo' },
  { typ: 'Wydatek', kategoria: 'Transport', podkategoria: 'Ubezpieczenie auta' },
  { typ: 'Wydatek', kategoria: 'Transport', podkategoria: 'Serwis/naprawy' },
  { typ: 'Wydatek', kategoria: 'Transport', podkategoria: 'Komunikacja miejska' },
  { typ: 'Wydatek', kategoria: 'Transport', podkategoria: 'Parking' },
  { typ: 'Wydatek', kategoria: 'Kredyty/Raty', podkategoria: 'Kredyt hipoteczny' },
  { typ: 'Wydatek', kategoria: 'Kredyty/Raty', podkategoria: 'Kredyt gotówkowy' },
  { typ: 'Wydatek', kategoria: 'Kredyty/Raty', podkategoria: 'Raty' },
  { typ: 'Wydatek', kategoria: 'Kredyty/Raty', podkategoria: 'Pożyczka prywatna' },  // NOWE
  { typ: 'Wydatek', kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' },
  { typ: 'Wydatek', kategoria: 'Jedzenie', podkategoria: 'Restauracje/miasto' },
  { typ: 'Wydatek', kategoria: 'Jedzenie', podkategoria: 'Praca' },
  { typ: 'Wydatek', kategoria: 'Jedzenie', podkategoria: 'Kawa/przekąski' },
  { typ: 'Wydatek', kategoria: 'Zdrowie', podkategoria: 'Lekarz' },
  { typ: 'Wydatek', kategoria: 'Zdrowie', podkategoria: 'Leki' },
  { typ: 'Wydatek', kategoria: 'Zdrowie', podkategoria: 'Suplementy' },
  { typ: 'Wydatek', kategoria: 'Zdrowie', podkategoria: 'Terapia i rehabilitacja' },  // NOWE
  { typ: 'Wydatek', kategoria: 'Zdrowie', podkategoria: 'Ubezpieczenie' },  // NOWE
  { typ: 'Wydatek', kategoria: 'Rozrywka', podkategoria: 'Kino/koncerty' },
  { typ: 'Wydatek', kategoria: 'Rozrywka', podkategoria: 'Subskrypcje' },
  { typ: 'Wydatek', kategoria: 'Rozrywka', podkategoria: 'Hobby' },
  { typ: 'Wydatek', kategoria: 'Rozrywka', podkategoria: 'Wyjazdy/wakacje' },
  { typ: 'Wydatek', kategoria: 'Rozrywka', podkategoria: 'Oprogramowanie i licencje' },  // NOWE
  { typ: 'Wydatek', kategoria: 'Rozrywka', podkategoria: 'Sport i aktywność' },  // NOWE
  { typ: 'Wydatek', kategoria: 'Rozrywka', podkategoria: 'Atrakcje i bilety' },  // NOWE
  { typ: 'Wydatek', kategoria: 'Dom', podkategoria: 'Wyposażenie' },
  { typ: 'Wydatek', kategoria: 'Dom', podkategoria: 'Chemia/środki czystości' },
  { typ: 'Wydatek', kategoria: 'Dom', podkategoria: 'Naprawy' },
  { typ: 'Wydatek', kategoria: 'Dom', podkategoria: 'Ogród' },
  { typ: 'Wydatek', kategoria: 'Zwierzęta', podkategoria: 'Karma' },  // NOWE
  { typ: 'Wydatek', kategoria: 'Zwierzęta', podkategoria: 'Akcesoria' },  // NOWE
  { typ: 'Wydatek', kategoria: 'Zwierzęta', podkategoria: 'Weterynarz' },  // NOWE
  { typ: 'Wydatek', kategoria: 'Ubrania', podkategoria: 'Dorośli' },
  { typ: 'Wydatek', kategoria: 'Ubrania', podkategoria: 'Obuwie' },  // NOWE
  { typ: 'Wydatek', kategoria: 'Inne', podkategoria: 'Prezenty' },
  { typ: 'Wydatek', kategoria: 'Inne', podkategoria: 'Fryzjer/kosmetyki' },
  { typ: 'Wydatek', kategoria: 'Inne', podkategoria: 'Darowizny' },  // NOWE
  { typ: 'Wydatek', kategoria: 'Inne', podkategoria: 'Wypłata gotówki' },  // NOWE
  { typ: 'Wydatek', kategoria: 'Inne', podkategoria: 'Transfer własny' },  // NOWE
  { typ: 'Wydatek', kategoria: 'Inne', podkategoria: 'Nieprzewidziane' },
  // Przychody
  { typ: 'Przychód', kategoria: 'Wynagrodzenie', podkategoria: 'Paweł' },
  { typ: 'Przychód', kategoria: 'Wynagrodzenie', podkategoria: 'Teresa' },
  { typ: 'Przychód', kategoria: 'Inne przychody', podkategoria: '800+' },
  { typ: 'Przychód', kategoria: 'Inne przychody', podkategoria: 'Zwroty' },
  { typ: 'Przychód', kategoria: 'Inne przychody', podkategoria: 'Premia' },
  { typ: 'Przychód', kategoria: 'Inne przychody', podkategoria: 'Sprzedaż rzeczy' },
  { typ: 'Przychód', kategoria: 'Inne przychody', podkategoria: 'Sprzedaż Allegro' },  // NOWE
  { typ: 'Przychód', kategoria: 'Inne przychody', podkategoria: 'Rozliczenia rodzinne' },  // NOWE
  { typ: 'Przychód', kategoria: 'Inne przychody', podkategoria: 'Transfer własny' },  // NOWE
  { typ: 'Przychód', kategoria: 'Inne przychody', podkategoria: 'Delegacje' },  // NOWE
];