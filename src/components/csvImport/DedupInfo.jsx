// używane przez widok Do rozliczenia (#132)
const formatZl = (n) =>
  `${Math.abs(Number(n)).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;

/** Odznaka statusu pod opisem wiersza + wybór dla możliwego duplikatu wpisu ręcznego. */
export default function DedupInfo({ dedup, onChange }) {
  const { status } = dedup;
  const badge = 'inline-block text-[11px] leading-tight px-2 py-0.5 rounded-full border mt-1 mr-1';

  if (status === 'zaksiegowana') {
    return (
      <div>
        <span className={`${badge} bg-gray-100 border-gray-200 text-gray-600`}>Już zaksięgowane</span>
        {dedup.istniejacaTransakcja === null && (
          <span className="text-[11px] text-gray-500">transakcję usunięto — zaznacz, aby dodać ponownie</span>
        )}
      </div>
    );
  }

  const reczny = dedup.reczne?.[0];
  return (
    <div>
      {status === 'polaczona' && dedup.zobowiazanie && (
        <span className={`${badge} bg-emerald-50 border-emerald-200 text-emerald-700`}>
          Faktura {dedup.zobowiazanie.kontrahent} {dedup.zobowiazanie.dokument}
          {dedup.udzial && ` · udział ${dedup.udzial}`}
        </span>
      )}
      {status === 'do_weryfikacji' && (
        <span
          className={`${badge} bg-amber-50 border-amber-200 text-amber-700`}
          title={dedup.kandydaci.map(z => `${z.kontrahent} ${z.dokument}`).join(', ')}
        >
          Do weryfikacji: {dedup.kandydaci.length === 1
            ? `może to ${dedup.kandydaci[0].kontrahent} ${dedup.kandydaci[0].dokument}`
            : `${dedup.kandydaci.length} faktury o tej kwocie`}
        </span>
      )}
      {reczny && (
        <div className="mt-1">
          <span className={`${badge} bg-orange-50 border-orange-200 text-orange-700`}>
            Możliwy duplikat wpisu z {reczny.data}: {reczny.komentarz || reczny.kategoria} {formatZl(reczny.kwota)}
          </span>
          <select
            aria-label="Co zrobić z możliwym duplikatem"
            value={dedup.wybrana === false ? 'pomin' : dedup.akcja}
            onChange={e => {
              const v = e.target.value;
              if (v === 'pomin') onChange({ wybrana: false });
              else if (v === 'dolacz') onChange({ wybrana: true, akcja: 'dolacz', dolaczDo: reczny.id });
              else onChange({ wybrana: true, akcja: 'nowa', dolaczDo: null });
            }}
            className="mt-1 border border-gray-200 rounded-lg px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
          >
            <option value="nowa">Dodaj jako nową</option>
            <option value="dolacz">To ten sam wpis — tylko zapisz dowód</option>
            <option value="pomin">Pomiń wiersz</option>
          </select>
        </div>
      )}
    </div>
  );
}
