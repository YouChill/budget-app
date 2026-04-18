import { useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';
import {
  MONTHS_PL_SHORT,
  aggregateByMonth,
  aggregateByCategory,
  aggregateByPerson,
  calculateYoY,
} from '../utils/calculations';

// Single hook that owns all data-fetching + derived computations for the
// yearly summary view. Returning everything as a flat object keeps the
// rendering component focused on layout and keeps recharts/jsx separate
// from data logic.
export function useYearlyData(year) {
  const [yearData, setYearData] = useState([]);
  const [prevYearData, setPrevYearData] = useState([]);
  const [compareYear, setCompareYear] = useState(null);
  const [compareData, setCompareData] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);

  // Fetch base year + prev year + available years list
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setCompareYear(null);
    setCompareData([]);

    (async () => {
      try {
        const [data, prevData, years] = await Promise.all([
          api.getTransakcjeForYear(year),
          api.getTransakcjeForYear(year - 1).catch(() => []),
          api.getAvailableYears().catch(() => [year]),
        ]);
        if (cancelled) return;
        setYearData(data || []);
        setPrevYearData(prevData || []);
        setAvailableYears(years);
      } catch {
        if (!cancelled) {
          setYearData([]);
          setPrevYearData([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [year]);

  // Fetch compare year on demand
  useEffect(() => {
    if (!compareYear) { setCompareData([]); return; }
    let cancelled = false;
    setIsLoadingCompare(true);
    api.getTransakcjeForYear(compareYear)
      .then(data => { if (!cancelled) setCompareData(data || []); })
      .catch(() => { if (!cancelled) setCompareData([]); })
      .finally(() => { if (!cancelled) setIsLoadingCompare(false); });
    return () => { cancelled = true; };
  }, [compareYear]);

  // Derived — base year
  const monthlyData = useMemo(() => aggregateByMonth(yearData), [yearData]);
  const totalIncome = useMemo(() => monthlyData.reduce((s, m) => s + m.przychody, 0), [monthlyData]);
  const totalExpenses = useMemo(() => monthlyData.reduce((s, m) => s + m.wydatki, 0), [monthlyData]);
  const totalBalance = totalIncome - totalExpenses;
  const avgMonthlyExpense = totalExpenses / 12;

  const cumulativeSavings = useMemo(() => {
    let cum = 0;
    return monthlyData.map(m => {
      cum += (m.przychody - m.wydatki);
      return { month: m.month, savings: Math.round(cum * 100) / 100 };
    });
  }, [monthlyData]);

  const categoryData = useMemo(() => aggregateByCategory(yearData, 'Wydatek'), [yearData]);
  const personData = useMemo(() => aggregateByPerson(yearData), [yearData]);
  const personPieData = useMemo(
    () => personData.map(p => ({ name: p.name, value: p.wydatki })).filter(p => p.value > 0),
    [personData]
  );
  const maxCategoryValue = categoryData.length > 0 ? categoryData[0].value : 1;

  // Derived — previous year (for YoY)
  const prevMonthlyData = useMemo(() => aggregateByMonth(prevYearData), [prevYearData]);
  const prevTotalIncome = useMemo(() => prevMonthlyData.reduce((s, m) => s + m.przychody, 0), [prevMonthlyData]);
  const prevTotalExpenses = useMemo(() => prevMonthlyData.reduce((s, m) => s + m.wydatki, 0), [prevMonthlyData]);
  const prevTotalBalance = prevTotalIncome - prevTotalExpenses;
  const yoyIncome = useMemo(() => calculateYoY(totalIncome, prevTotalIncome), [totalIncome, prevTotalIncome]);
  const yoyExpenses = useMemo(() => calculateYoY(totalExpenses, prevTotalExpenses), [totalExpenses, prevTotalExpenses]);
  const yoyBalance = useMemo(() => calculateYoY(totalBalance, prevTotalBalance), [totalBalance, prevTotalBalance]);

  // Derived — compare year
  const compareMonthlyData = useMemo(() => aggregateByMonth(compareData), [compareData]);
  const compareCategoryData = useMemo(() => aggregateByCategory(compareData, 'Wydatek'), [compareData]);
  const compareTotalIncome = useMemo(() => compareMonthlyData.reduce((s, m) => s + m.przychody, 0), [compareMonthlyData]);
  const compareTotalExpenses = useMemo(() => compareMonthlyData.reduce((s, m) => s + m.wydatki, 0), [compareMonthlyData]);

  const compareChartData = useMemo(() => {
    if (!compareYear) return [];
    return MONTHS_PL_SHORT.map((m, i) => ({
      month: m,
      [`Wydatki ${year}`]: monthlyData[i].wydatki,
      [`Wydatki ${compareYear}`]: compareMonthlyData[i].wydatki,
      [`Przychody ${year}`]: monthlyData[i].przychody,
      [`Przychody ${compareYear}`]: compareMonthlyData[i].przychody,
    }));
  }, [compareYear, year, monthlyData, compareMonthlyData]);

  const categoryCompareTable = useMemo(() => {
    if (!compareYear) return [];
    const map = new Map();
    categoryData.forEach(c => map.set(c.name, { base: c.value, compare: 0 }));
    compareCategoryData.forEach(c => {
      if (map.has(c.name)) map.get(c.name).compare = c.value;
      else map.set(c.name, { base: 0, compare: c.value });
    });
    return Array.from(map.entries())
      .map(([name, { base, compare }]) => ({ name, base, compare, change: base - compare }))
      .sort((a, b) => b.base - a.base);
  }, [compareYear, categoryData, compareCategoryData]);

  return {
    // raw state
    yearData,
    prevYearData,
    availableYears,
    compareYear,
    setCompareYear,
    isLoading,
    isLoadingCompare,

    // base year totals + aggregations
    monthlyData,
    totalIncome,
    totalExpenses,
    totalBalance,
    avgMonthlyExpense,
    cumulativeSavings,
    categoryData,
    personData,
    personPieData,
    maxCategoryValue,

    // YoY
    yoyIncome,
    yoyExpenses,
    yoyBalance,

    // compare
    compareMonthlyData,
    compareCategoryData,
    compareTotalIncome,
    compareTotalExpenses,
    compareChartData,
    categoryCompareTable,
  };
}
