// ─── Date normalization ───────────────────────────────────────────────────────
// Accepts: "YYYY-MM-DD", "DD.MM.YYYY", "DD-MM-YYYY"
// Returns ISO string "YYYY-MM-DD" or null for invalid input.
//
// Walidujemy przez rekonstrukcję daty i porównanie składowych — dzięki temu
// nieistniejące daty (np. 30.02, 31.04) są odrzucane niezależnie od tego, czy
// silnik JS „przewija" je na kolejny miesiąc.
const isValidIsoDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
};

export const normalizeDateToISO = (dateStr) => {
  if (!dateStr) return null;
  const str = dateStr.toString().trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return isValidIsoDate(str) ? str : null;
  }
  const match = str.match(/^(\d{2})[.-](\d{2})[.-](\d{4})$/);
  if (match) {
    const iso = `${match[3]}-${match[2]}-${match[1]}`;
    return isValidIsoDate(iso) ? iso : null;
  }
  return null;
};

// ─── Amount parsing ────────────────────────────────────────────────────────────
// Akceptuje formaty z separatorem tysięcy (kropka) i dziesiętnym (przecinek),
// np. "1.234,56" → 1234.56, a także zwykłe "-150,00" → -150. Liczby przekazane
// jako number są zwracane bez zmian (bez ryzyka ponownego przeparsowania).
export const parseKwota = (kwotaStr) => {
  if (kwotaStr == null || kwotaStr === '') return 0;
  if (typeof kwotaStr === 'number') return isNaN(kwotaStr) ? 0 : kwotaStr;
  let str = kwotaStr.toString().trim().replace(/[\s\u00A0]/g, '');
  if (/\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else {
    str = str.replace(',', '.');
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};
