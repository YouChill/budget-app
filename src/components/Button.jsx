import React from 'react';

// Wspólny przycisk — jedno źródło stylu dla akcji w całej aplikacji.
// Warianty odpowiadają konwencji kolorów aplikacji:
//   primary   — główna akcja (gradient indigo→purple)
//   secondary — akcja drugorzędna (obrys, np. „Wstecz", „Anuluj")
//   success   — akcja potwierdzająca/zastosowanie (emerald)
//   danger    — akcja destrukcyjna (rose)
const VARIANTS = {
  primary:
    'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300',
  secondary: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  danger: 'bg-rose-500 text-white hover:bg-rose-600',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-8 py-3 text-base',
};

export default function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  return (
    <button
      className={`rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
