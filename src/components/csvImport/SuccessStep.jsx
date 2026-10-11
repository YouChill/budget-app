import Button from '../Button';
import { SparkleIcon } from './icons';

// Krok 4: podsumowanie importu (dodane, połączone z fakturami, pominięte).
export default function SuccessStep({ importRaport, aiEnabled, onClose }) {
  return (
      <div className="text-center py-8 space-y-5">
        <div className="mx-auto w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-gray-800">Import zakończony!</h3>
          <p className="text-gray-400 mt-1">
            Zaimportowano <strong className="text-gray-600">{importRaport?.dodane ?? 0}</strong> transakcji
          </p>
          {importRaport && (importRaport.pominiete > 0 || importRaport.polaczone > 0 || importRaport.dolaczone > 0) && (
            <ul className="text-sm text-gray-500 mt-2 space-y-0.5">
              {importRaport.polaczone > 0 && <li>Połączono z fakturami: <strong>{importRaport.polaczone}</strong></li>}
              {importRaport.dolaczone > 0 && <li>Dołączono do istniejących wpisów: <strong>{importRaport.dolaczone}</strong></li>}
              {importRaport.pominiete > 0 && <li>Pominięto jako już zaksięgowane: <strong>{importRaport.pominiete}</strong></li>}
            </ul>
          )}
          {aiEnabled && (
            <p className="text-xs text-violet-500 mt-2 flex items-center justify-center gap-1">
              <SparkleIcon size={12} /> Kategorie zapisane w bazie wektorowej AI
            </p>
          )}
        </div>
        <Button size="lg" onClick={onClose}>
          Zamknij
        </Button>
      </div>
  );
}
