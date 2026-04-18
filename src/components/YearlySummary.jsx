import { useState } from 'react';
import { useYearlyData } from '../hooks/useYearlyData';
import { LoaderIcon } from './yearly/primitives';
import OverviewTab from './yearly/OverviewTab';
import CompareTab from './yearly/CompareTab';
import PersonsTab from './yearly/PersonsTab';

const TABS = [
  { id: 'overview', label: 'Przegląd' },
  { id: 'compare', label: 'Porównanie lat' },
  { id: 'persons', label: 'Osoby' },
];

export default function YearlySummary({ year }) {
  const [activeTab, setActiveTab] = useState('overview');
  const data = useYearlyData(year);

  if (data.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-500">
          <LoaderIcon />
          <span>Ładowanie danych rocznych...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-1 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-indigo-500 text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <OverviewTab
          prevYearData={data.prevYearData}
          monthlyData={data.monthlyData}
          totalIncome={data.totalIncome}
          totalExpenses={data.totalExpenses}
          totalBalance={data.totalBalance}
          avgMonthlyExpense={data.avgMonthlyExpense}
          cumulativeSavings={data.cumulativeSavings}
          categoryData={data.categoryData}
          maxCategoryValue={data.maxCategoryValue}
          yoyIncome={data.yoyIncome}
          yoyExpenses={data.yoyExpenses}
          yoyBalance={data.yoyBalance}
        />
      )}

      {activeTab === 'compare' && (
        <CompareTab
          year={year}
          availableYears={data.availableYears}
          compareYear={data.compareYear}
          setCompareYear={data.setCompareYear}
          isLoadingCompare={data.isLoadingCompare}
          totalIncome={data.totalIncome}
          totalExpenses={data.totalExpenses}
          compareTotalIncome={data.compareTotalIncome}
          compareTotalExpenses={data.compareTotalExpenses}
          compareChartData={data.compareChartData}
          categoryCompareTable={data.categoryCompareTable}
        />
      )}

      {activeTab === 'persons' && (
        <PersonsTab
          personData={data.personData}
          personPieData={data.personPieData}
        />
      )}
    </div>
  );
}
