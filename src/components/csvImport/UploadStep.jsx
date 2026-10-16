import { useRef, useState } from 'react';
import { BankIcon, ListIcon, SparkleIcon, TableIcon } from './icons';

// Krok 1: wybór pliku (kliknięcie lub przeciągnięcie) i obsługiwane formaty.
export default function UploadStep({ onFile, selectedFileName, aiEnabled }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) onFile(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear if leaving the drop zone itself (not a child)
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
      <div className="space-y-5">

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
            transition-all duration-200 group
            ${isDragging
              ? 'border-indigo-500 bg-indigo-50 scale-[1.01] shadow-lg shadow-indigo-100'
              : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/40 hover:shadow-md'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Icon */}
          <div className={`
            mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-5 transition-all duration-200
            ${isDragging ? 'bg-indigo-100 scale-110' : 'bg-white shadow-sm group-hover:bg-indigo-50 group-hover:scale-105'}
          `}>
            <svg className={`w-10 h-10 transition-colors ${isDragging ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>

          <h3 className={`text-xl font-semibold mb-1 transition-colors ${isDragging ? 'text-indigo-700' : 'text-gray-700'}`}>
            {isDragging ? 'Upuść plik tutaj' : 'Przeciągnij plik CSV tutaj'}
          </h3>
          <p className="text-gray-400 text-sm mb-6">lub</p>

          <div className={`
            inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all
            ${isDragging
              ? 'bg-indigo-600 text-white'
              : 'bg-indigo-600 text-white group-hover:bg-indigo-700 shadow-sm shadow-indigo-200'
            }
          `}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Wybierz plik z dysku
          </div>

          {selectedFileName && (
            <p className="mt-4 text-sm text-indigo-600 font-medium">
              Wybrany: {selectedFileName}
            </p>
          )}
        </div>

        {/* Supported formats */}
        <div className="flex flex-col gap-1.5">
          {[
            { icon: <BankIcon />, label: 'Rozpoznawanie automatyczne', desc: 'PKO BP / iPKO, Bank Millennium' },
            { icon: <TableIcon />, label: 'CSV z nagłówkami', desc: 'standardowy format' },
            { icon: <ListIcon />, label: 'CSV bez nagłówków', desc: 'mapowanie ręczne' },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="flex items-center gap-2 text-sm text-gray-500">
              <span className="text-indigo-400 leading-none">{icon}</span>
              <span className="font-medium text-gray-700 whitespace-nowrap">{label}:</span>
              <span className="text-gray-500 whitespace-nowrap">{desc}</span>
            </div>
          ))}
        </div>

        {/* AI badge */}
        {aiEnabled && (
          <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
            <span className="text-violet-500"><SparkleIcon size={18} /></span>
            <div>
              <span className="text-sm font-semibold text-violet-700">Kategoryzacja AI włączona</span>
              <span className="text-xs text-violet-500 ml-2">
                Transakcje bez dopasowania zostaną automatycznie skategoryzowane przez AI
              </span>
            </div>
          </div>
        )}
      </div>
  );
}
