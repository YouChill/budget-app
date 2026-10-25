import React from 'react';
// ─── Step indicator component ─────────────────────────────────────────────────
export default function StepIndicator({ current }) {
  const steps = [
    { n: 1, label: 'Plik' },
    { n: 2, label: 'Kolumny' },
    { n: 3, label: 'Gotowe' },
  ];
  return (
    <div className="flex items-center justify-center gap-1 mb-6 select-none">
      {steps.map(({ n, label }, i) => (
        <React.Fragment key={n}>
          <div className="flex items-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                current > n
                  ? 'bg-emerald-500 text-white'
                  : current === n
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {current > n ? '✓' : n}
            </div>
            <span
              className={`text-sm hidden sm:block transition-colors ${
                current === n ? 'text-indigo-700 font-semibold' : 'text-gray-400'
              }`}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 w-8 sm:w-12 rounded-full transition-all duration-300 ${
                current > n ? 'bg-emerald-400' : 'bg-gray-200'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
