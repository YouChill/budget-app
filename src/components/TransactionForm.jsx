import { useState } from 'react';
import ModalShell from './ModalShell';
import { Icons } from './Icons';

// Komponent formularza transakcji
export default function TransactionForm({ onSubmit, onClose, kategorie, osoby, isLoading, editData }) {
  const isEditMode = !!editData;
  
  const [formData, setFormData] = useState(() => {
    if (editData) {
      // Normalizuj datę do formatu YYYY-MM-DD
      let normalizedDate = editData.data;
      if (editData.data) {
        const d = new Date(editData.data);
        if (!isNaN(d.getTime())) {
          normalizedDate = d.toISOString().split('T')[0];
        }
      }
      return {
        data: normalizedDate,
        typ: editData.typ || 'Wydatek',
        kwota: String(editData.kwota || ''),
        kategoria: editData.kategoria || '',
        podkategoria: editData.podkategoria || '',
        osoba: editData.osoba || osoby[0] || '',
        komentarz: editData.komentarz || ''
      };
    }
    return {
      data: new Date().toISOString().split('T')[0],
      typ: 'Wydatek',
      kwota: '',
      kategoria: '',
      podkategoria: '',
      osoba: osoby[0] || '',
      komentarz: ''
    };
  });
  
  const dostepneKategorie = kategorie[formData.typ] || {};
  const dostepnePodkategorie = dostepneKategorie[formData.kategoria] || [];
  
  // Handler zmiany typu - resetuje kategorię i podkategorię
  const handleTypChange = (typ) => {
    setFormData(prev => ({ 
      ...prev, 
      typ,
      kategoria: '',
      podkategoria: ''
    }));
  };
  
  // Handler zmiany kategorii - resetuje podkategorię
  const handleKategoriaChange = (kategoria) => {
    setFormData(prev => ({ 
      ...prev, 
      kategoria,
      podkategoria: ''
    }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.kwota || !formData.kategoria) return;
    onSubmit({
      ...formData,
      kwota: parseFloat(formData.kwota)
    });
  };
  
  return (
    <ModalShell onClose={onClose} labelId="transaction-form-title">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
        <h2 id="transaction-form-title" className="text-xl font-semibold text-gray-800">
          {isEditMode ? 'Edytuj transakcję' : 'Nowa transakcja'}
        </h2>
        <button
          onClick={onClose}
          aria-label="Zamknij formularz"
          className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <Icons.X />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Typ transakcji */}
          <div className="flex gap-2">
            {['Wydatek', 'Przychód'].map(typ => (
              <button
                key={typ}
                type="button"
                onClick={() => handleTypChange(typ)}
                className={`flex-1 rounded-xl py-3 px-4 font-medium transition-all ${
                  formData.typ === typ
                    ? typ === 'Wydatek' 
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-200'
                      : 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {typ}
              </button>
            ))}
          </div>
          
          {/* Data i kwota */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0 overflow-hidden">
              <label htmlFor="transaction-date" className="block text-sm font-medium text-gray-600 mb-2">Data</label>
              <input
                id="transaction-date"
                type="date"
                value={formData.data}
                onChange={e => setFormData(prev => ({ ...prev, data: e.target.value }))}
                className="w-full min-w-0 rounded-xl border border-gray-200 px-3 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label htmlFor="transaction-amount" className="block text-sm font-medium text-gray-600 mb-2">Kwota (PLN)</label>
              <input
                id="transaction-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.kwota}
                onChange={e => setFormData(prev => ({ ...prev, kwota: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                required
              />
            </div>
          </div>
          
          {/* Kategoria i podkategoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="transaction-category" className="block text-sm font-medium text-gray-600 mb-2">Kategoria</label>
              <select
                id="transaction-category"
                value={formData.kategoria}
                onChange={e => handleKategoriaChange(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white"
                required
              >
                <option value="">Wybierz...</option>
                {Object.keys(dostepneKategorie).map(kat => (
                  <option key={kat} value={kat}>{kat}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="transaction-subcategory" className="block text-sm font-medium text-gray-600 mb-2">Podkategoria</label>
              <select
                id="transaction-subcategory"
                value={formData.podkategoria}
                onChange={e => setFormData(prev => ({ ...prev, podkategoria: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white"
                disabled={!formData.kategoria}
              >
                <option value="">Wybierz...</option>
                {dostepnePodkategorie.map(pod => (
                  <option key={pod} value={pod}>{pod}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Osoba */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Osoba</label>
            <div className="flex gap-2">
              {osoby.map(osoba => (
                <button
                  key={osoba}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, osoba }))}
                  className={`flex-1 rounded-xl py-3 px-4 font-medium transition-all ${
                    formData.osoba === osoba
                      ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {osoba}
                </button>
              ))}
            </div>
          </div>
          
          {/* Komentarz */}
          <div>
            <label htmlFor="transaction-comment" className="block text-sm font-medium text-gray-600 mb-2">Komentarz (opcjonalnie)</label>
            <input
              id="transaction-comment"
              type="text"
              placeholder="np. zakupy w Biedronce"
              value={formData.komentarz}
              onChange={e => setFormData(prev => ({ ...prev, komentarz: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
            />
          </div>
          
          {/* Przycisk */}
          <button
            type="submit"
            disabled={isLoading || !formData.kwota || !formData.kategoria}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-4 font-semibold text-white shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <><Icons.Loader /> Zapisywanie...</>
            ) : isEditMode ? (
              <><Icons.Edit /> Zapisz zmiany</>
            ) : (
              <><Icons.Plus /> Dodaj transakcję</>
            )}
          </button>
      </form>
    </ModalShell>
  );
}
