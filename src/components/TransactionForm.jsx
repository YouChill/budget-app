import React, { useState, useEffect } from 'react';

/**
 * UWAGA: ten komponent NIE jest używany przez aplikację — App.jsx ma własną,
 * inaczej wyglądającą implementację formularza. Plik istnieje wyłącznie jako
 * odniesienie i pod testy jednostkowe; przy zmianach UI edytuj wersję w App.jsx.
 *
 * Formularz do dodawania/edycji transakcji
 * @param {Object} props
 * @param {Object} kategorie - Kategorie zgrupowane: { Wydatek: { cat: [subcats] }, Przychód: {...} }
 * @param {Array} osoby - Lista osób
 * @param {Object} [initialTransaction] - Dane do edycji (opcjonalne)
 * @param {Function} onSubmit - Callback po submitowaniu
 * @param {Function} onClose - Callback po zamknięciu
 * @param {boolean} [isLoading=false] - Stan ładowania
 */
export default function TransactionForm({
  kategorie = {},
  osoby = [],
  initialTransaction = null,
  onSubmit,
  onClose,
  isLoading = false
}) {
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    typ: 'Wydatek',
    kwota: '',
    kategoria: '',
    podkategoria: '',
    osoba: '',
    komentarz: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialTransaction) {
      setFormData({
        data: initialTransaction.data || new Date().toISOString().split('T')[0],
        typ: initialTransaction.typ || 'Wydatek',
        kwota: String(initialTransaction.kwota || ''),
        kategoria: initialTransaction.kategoria || '',
        podkategoria: initialTransaction.podkategoria || '',
        osoba: initialTransaction.osoba || '',
        komentarz: initialTransaction.komentarz || ''
      });
    }
  }, [initialTransaction]);

  const currentTypeCategories = kategorie[formData.typ] || {};
  const subcategories = currentTypeCategories[formData.kategoria] || [];

  const handleTypeChange = (e) => {
    const newType = e.target.value;
    setFormData(prev => ({
      ...prev,
      typ: newType,
      kategoria: '',
      podkategoria: ''
    }));
    setErrors(prev => ({ ...prev, kategoria: '' }));
  };

  const handleCategoryChange = (e) => {
    const newCategory = e.target.value;
    setFormData(prev => ({
      ...prev,
      kategoria: newCategory,
      podkategoria: ''
    }));
    setErrors(prev => ({ ...prev, kategoria: '' }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.data) newErrors.data = 'Data jest wymagana';
    if (!formData.typ) newErrors.typ = 'Typ jest wymagany';
    if (!formData.kwota || parseFloat(formData.kwota) <= 0) {
      newErrors.kwota = 'Kwota musi być większa od 0';
    }
    if (!formData.kategoria) newErrors.kategoria = 'Kategoria jest wymagana';
    if (!formData.osoba) newErrors.osoba = 'Osoba jest wymagana';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    onSubmit({
      ...formData,
      kwota: parseFloat(formData.kwota)
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Wyczyść błąd dla tego pola
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="transaction-form">
      {/* Data */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Data
        </label>
        <input
          type="date"
          name="data"
          value={formData.data}
          onChange={handleChange}
          disabled={isLoading}
          className={`w-full px-3 py-2 border rounded-lg ${
            errors.data ? 'border-red-500' : 'border-gray-300'
          } disabled:bg-gray-100`}
          data-testid="field-data"
        />
        {errors.data && <span className="text-sm text-red-600">{errors.data}</span>}
      </div>

      {/* Typ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Typ
        </label>
        <select
          name="typ"
          value={formData.typ}
          onChange={handleTypeChange}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
          data-testid="field-typ"
        >
          <option value="Wydatek">Wydatek</option>
          <option value="Przychód">Przychód</option>
        </select>
      </div>

      {/* Kwota */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Kwota
        </label>
        <input
          type="number"
          name="kwota"
          value={formData.kwota}
          onChange={handleChange}
          disabled={isLoading}
          placeholder="0.00"
          step="0.01"
          min="0"
          className={`w-full px-3 py-2 border rounded-lg ${
            errors.kwota ? 'border-red-500' : 'border-gray-300'
          } disabled:bg-gray-100`}
          data-testid="field-kwota"
        />
        {errors.kwota && <span className="text-sm text-red-600">{errors.kwota}</span>}
      </div>

      {/* Kategoria */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Kategoria
        </label>
        <select
          name="kategoria"
          value={formData.kategoria}
          onChange={handleCategoryChange}
          disabled={isLoading}
          className={`w-full px-3 py-2 border rounded-lg ${
            errors.kategoria ? 'border-red-500' : 'border-gray-300'
          } disabled:bg-gray-100`}
          data-testid="field-kategoria"
        >
          <option value="">-- Wybierz kategorię --</option>
          {Object.keys(currentTypeCategories).map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        {errors.kategoria && <span className="text-sm text-red-600">{errors.kategoria}</span>}
      </div>

      {/* Podkategoria */}
      {subcategories.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Podkategoria
          </label>
          <select
            name="podkategoria"
            value={formData.podkategoria}
            onChange={handleChange}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
            data-testid="field-podkategoria"
          >
            <option value="">-- Bez podkategorii --</option>
            {subcategories.map(subcat => (
              <option key={subcat} value={subcat}>{subcat}</option>
            ))}
          </select>
        </div>
      )}

      {/* Osoba */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Osoba
        </label>
        <select
          name="osoba"
          value={formData.osoba}
          onChange={handleChange}
          disabled={isLoading}
          className={`w-full px-3 py-2 border rounded-lg ${
            errors.osoba ? 'border-red-500' : 'border-gray-300'
          } disabled:bg-gray-100`}
          data-testid="field-osoba"
        >
          <option value="">-- Wybierz osobę --</option>
          {osoby.map(osoba => (
            <option key={osoba} value={osoba}>{osoba}</option>
          ))}
        </select>
        {errors.osoba && <span className="text-sm text-red-600">{errors.osoba}</span>}
      </div>

      {/* Komentarz */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Komentarz
        </label>
        <textarea
          name="komentarz"
          value={formData.komentarz}
          onChange={handleChange}
          disabled={isLoading}
          placeholder="Opcjonalnie..."
          rows="3"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
          data-testid="field-komentarz"
        />
      </div>

      {/* Przyciski */}
      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
          data-testid="button-submit"
        >
          {isLoading && (
            <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
            </svg>
          )}
          {initialTransaction ? 'Aktualizuj' : 'Dodaj'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium"
          data-testid="button-close"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}
