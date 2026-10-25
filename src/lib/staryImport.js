// Autozapis kreatora importu sprzed #131 trzymał pełne opisy i kwoty
// operacji w localStorage — także po wylogowaniu. Kreator już go nie
// tworzy, a przy starcie aplikacji usuwamy to, co zostało w przeglądarkach.
export const STARY_KLUCZ_IMPORTU = 'csv_import_progress';

export function usunStaryPostepImportu(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(STARY_KLUCZ_IMPORTU);
  } catch {
    // localStorage zablokowany (tryb prywatny) — nie ma czego sprzątać
  }
}
