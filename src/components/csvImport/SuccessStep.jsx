import Button from '../Button';

// Krok 3: podsumowanie zapisu wyciągu do kolejki (#131).
export default function SuccessStep({ raport, onClose, onOpenKolejka }) {
  const dodane = raport?.dodane ?? 0;
  const pominiete = raport?.pominiete ?? 0;
  return (
      <div className="text-center py-8 space-y-5">
        <div className="mx-auto w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-gray-800">Wyciąg w kolejce</h3>
          <p className="text-gray-500 mt-1">
            Dodano do kolejki: <strong className="text-gray-700">{dodane}</strong>
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            Pominięto (już w kolejce lub zaksięgowane): <strong>{pominiete}</strong>
          </p>
          {raport?.bledneDaty > 0 && (
            <p className="text-sm text-amber-600 mt-0.5">
              Wiersze z nieprawidłową datą (niezapisane): <strong>{raport.bledneDaty}</strong>
            </p>
          )}
          <p className="text-xs text-gray-400 mt-3">
            Kategorie przypiszesz w widoku „Do rozliczenia" — w dowolnym momencie i z dowolnego urządzenia.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="secondary" size="lg" onClick={onClose}>
            Zamknij
          </Button>
          <Button size="lg" onClick={onOpenKolejka}>
            Przejdź do rozliczenia
          </Button>
        </div>
      </div>
  );
}
