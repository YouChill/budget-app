// Allegro → eksport zakupów do JSON (Budżet Domowy)
//
// Skrypt do konsoli przeglądarki, nie dla Node. Wynik (allegro_<data>.json)
// paruje się z płatnościami Allegro na wyciągu po payment.id i kwocie;
// pozycje idą do pliku importu (zrodlo 'allegro', odcisk payment.id|order.id).
//
// Jak użyć:
//   1. Zaloguj się na konto Allegro (osobno Paweł, osobno Teresa).
//   2. Otwórz https://allegro.pl/moje-allegro/zakupy/kupione
//   3. Konsola przeglądarki (Chrome: ⌥⌘J / F12, Safari: ⌥⌘C), wklej cały plik, Enter.
//   4. Poczekaj, aż pobierze się plik allegro_<data>.json (ok. 0,5 s na zamówienie).
//
// Plik zawiera adres i telefon z zamówień: nie wrzucaj go do repo
// (wzorzec allegro_*.json jest w .gitignore).

(async () => {
  const OD = '2026-08-01';      // pobieraj zamówienia od tej daty
  const PAUZA_MS = 450;         // przy szybszych zapytaniach Allegro ucina połączenie
  const STOP_PO_STARSZYCH = 3;  // lista jest od najnowszych: przerwij po 3 starszych z rzędu

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (...a) => console.log('%c[allegro]', 'color:#ff5a00;font-weight:bold', ...a);

  // ── 1. Linki do szczegółów zakupów ────────────────────────────────────────
  const WZOR = /\/moje-allegro\/zakupy\/kupione\/[0-9a-f-]{36}/i;
  const zbierzLinki = () => [...new Set(
    [...document.querySelectorAll('a[href]')]
      .map((a) => a.href.split(/[?#]/)[0])
      .filter((h) => WZOR.test(h))
  )];

  // Lista doładowuje się przy przewijaniu albo po „Pokaż więcej”.
  let poprzednio = -1;
  for (let i = 0; i < 60; i++) {
    const n = zbierzLinki().length;
    if (n === poprzednio && i > 2) break;
    poprzednio = n;
    window.scrollTo(0, document.body.scrollHeight);
    [...document.querySelectorAll('button, a')]
      .find((b) => /pokaż więcej|załaduj więcej|następna/i.test(b.textContent || ''))
      ?.click();
    await sleep(1200);
  }
  const linki = zbierzLinki();
  log(`Znalezione zakupy na liście: ${linki.length}`);
  if (!linki.length) {
    log('Brak linków do zakupów. Czy jesteś na stronie Moje Allegro → Zakupy → Kupione?');
    return;
  }

  // ── 2. Pomocnicze: JSON osadzony w stronie ───────────────────────────────
  const jsonyZeStrony = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const wynik = [];
    for (const s of doc.querySelectorAll('script[type="application/json"], script[type="application/ld+json"]')) {
      try { wynik.push(JSON.parse(s.textContent)); } catch { /* nie-JSON, pomiń */ }
    }
    return wynik;
  };

  // Szuka w drzewie obiektu tablic `myorders` (klasy CSS zmieniają się co wdrożenie, JSON nie).
  const znajdzMyorders = (wezel, wynik = [], glebokosc = 0) => {
    if (!wezel || typeof wezel !== 'object' || glebokosc > 25) return wynik;
    if (Array.isArray(wezel.myorders)) wynik.push(...wezel.myorders);
    for (const v of Object.values(wezel)) znajdzMyorders(v, wynik, glebokosc + 1);
    return wynik;
  };

  // Pierwsza data ISO w zamówieniu (nazwa pola bywa różna).
  const dataZamowienia = (o) => {
    const kandydaci = ['orderDate', 'boughtDate', 'purchaseDate', 'createdAt', 'date'];
    for (const k of kandydaci) if (typeof o?.[k] === 'string' && /^\d{4}-\d{2}-\d{2}/.test(o[k])) return o[k].slice(0, 10);
    const txt = JSON.stringify(o).match(/"(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}/);
    return txt ? txt[1] : null;
  };

  // ── 3. Pobranie szczegółów ───────────────────────────────────────────────
  const zamowienia = [];
  const widziane = new Set();
  const bledy = [];
  let starszychZRzedu = 0;

  for (const [i, url] of linki.entries()) {
    try {
      const odp = await fetch(url, { credentials: 'include' });
      if (!odp.ok) throw new Error(`HTTP ${odp.status}`);
      const orders = jsonyZeStrony(await odp.text()).flatMap((j) => znajdzMyorders(j));
      if (!orders.length) throw new Error('brak orderGroup.myorders w stronie');

      let wszystkieStarsze = true;
      for (const o of orders) {
        const klucz = o.id || o.orderId || JSON.stringify(o).slice(0, 200);
        if (widziane.has(klucz)) continue;
        widziane.add(klucz);
        const data = dataZamowienia(o);
        if (!data || data >= OD) wszystkieStarsze = false;
        zamowienia.push({ url, data, ...o });
      }
      starszychZRzedu = wszystkieStarsze ? starszychZRzedu + 1 : 0;
      log(`${i + 1}/${linki.length}  ${orders.length} zam.  ${dataZamowienia(orders[0]) ?? '?'}`);
      if (starszychZRzedu >= STOP_PO_STARSZYCH) {
        log(`Kolejne zakupy są sprzed ${OD}, kończę.`);
        break;
      }
    } catch (e) {
      bledy.push({ url, blad: String(e.message || e) });
      log(`${i + 1}/${linki.length}  BŁĄD: ${e.message}`);
    }
    await sleep(PAUZA_MS);
  }

  const wOkresie = zamowienia.filter((o) => !o.data || o.data >= OD);

  // ── 4. Podgląd i zapis pliku ─────────────────────────────────────────────
  const kwota = (v) => (v && typeof v === 'object' ? v.amount ?? v.value : v);
  console.table(wOkresie.map((o) => ({
    data: o.data,
    platnosc: kwota(o.payment?.amount),
    po_kuponie: kwota(o.totalCost),
    produkty: (o.offers || []).map((x) => x.title).join(' | ').slice(0, 90),
  })));

  const plik = {
    wygenerowano: new Date().toISOString(),
    od: OD,
    liczba_zamowien: wOkresie.length,
    bledy,
    zamowienia: wOkresie,
  };
  const blob = new Blob([JSON.stringify(plik, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `allegro_${new Date().toISOString().slice(0, 10)}.json`,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  log(`Gotowe: ${wOkresie.length} zamówień od ${OD}, błędów: ${bledy.length}. Plik pobrany.`);
})();
