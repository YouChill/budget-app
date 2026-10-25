import { useState } from 'react';
import ConfirmDialog from '../ConfirmDialog';

const odmiana = (n) => (n === 1 ? 'regułę' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'reguły' : 'reguł');

// Jednorazowe przeniesienie reguł rozpoznawania z localStorage tego
// urządzenia do bazy (#133). „Nie" usuwa je dopiero po drugim potwierdzeniu,
// żeby jedno kliknięcie nie skasowało reguł zbieranych miesiącami.
export default function LocalRulesMigrationDialog({ lokalne, onPrzenies, onOdrzuc, onPozniej }) {
  const [krok, setKrok] = useState('pytanie');
  if (!lokalne) return null;

  const { doPrzeniesienia, krotkie } = lokalne;
  const n = doPrzeniesienia.length;
  const pominiete = krotkie.length > 0
    ? ` Pominięte (krótsze niż 3 znaki): ${krotkie.map(r => `„${r.keyword}”`).join(', ')}.`
    : '';

  if (krok === 'usun' || n === 0) {
    return (
      <ConfirmDialog
        title="Usunąć reguły z tego urządzenia?"
        message={n === 0
          ? `Na tym urządzeniu są tylko reguły za krótkie do przeniesienia.${pominiete}`
          : `Reguły z tego urządzenia (${n}) nie trafią do bazy i znikną.`}
        confirmLabel={n === 0 ? 'Usuń' : 'Nie, usuń'}
        cancelLabel={n === 0 ? 'Później' : 'Wróć'}
        onConfirm={onOdrzuc}
        onCancel={() => (n === 0 ? onPozniej() : setKrok('pytanie'))}
      />
    );
  }

  return (
    <ConfirmDialog
      title="Przenieść reguły do bazy?"
      message={`Przenieść ${n} ${odmiana(n)} z tego urządzenia do bazy? Będą widoczne na wszystkich urządzeniach i dla domowników.${pominiete}`}
      confirmLabel="Przenieś"
      cancelLabel="Nie"
      isWarning
      onConfirm={onPrzenies}
      onCancel={() => setKrok('usun')}
    />
  );
}
