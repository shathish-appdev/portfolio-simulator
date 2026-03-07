import xirr from 'xirr';
import { NavEntry } from '../../../types/navData';
import { areDatesContinuous, getNthPreviousMonthDate } from '../../date/dateUtils';
import { fillMissingNavDates } from '../../data/fillMissingNavDates';
import { calculateVolatility, DailyPortfolioValue } from './volatility/volatilityCalculator';
import { Transaction } from '../sipRollingXirr/types';

// ============================================================================
// TYPES
// ============================================================================

export interface RollingXirrEntry {
  date: Date;
  xirr: number;
  transactions: Transaction[];
  volatility?: number;
}

export type { Transaction } from '../sipRollingXirr/types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function toDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function buildDateMap(fund: NavEntry[]): Map<string, NavEntry> {
  return new Map(fund.map(entry => [toDateKey(entry.date), entry]));
}

function ensureContinuousDates(fund: NavEntry[]): NavEntry[] {
  return areDatesContinuous(fund) ? fund : fillMissingNavDates(fund);
}

function isValidInput(navDataList: NavEntry[][]): boolean {
  return navDataList.length > 0 && navDataList.every(fund => fund.length >= 2);
}

function getSortedDates(fund: NavEntry[]): NavEntry[] {
  return [...fund].sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ============================================================================
// FUND UNITS AND TOTAL VALUE
// ============================================================================

function calculateFundUnits(
  fundDateMaps: Map<string, NavEntry>[],
  startDate: Date,
  allocations: number[],
  investmentAmount: number
): number[] | null {
  const units: number[] = [];
  const startKey = toDateKey(startDate);

  for (let f = 0; f < fundDateMaps.length; f++) {
    const navEntry = fundDateMaps[f].get(startKey);
    if (!navEntry) return null;
    const allocation = (investmentAmount * allocations[f]) / 100;
    units[f] = allocation / navEntry.nav;
  }
  return units;
}

function calculateTotalValue(
  fundDateMaps: Map<string, NavEntry>[],
  endDate: Date,
  fundUnits: number[]
): number | null {
  let total = 0;
  const endKey = toDateKey(endDate);

  for (let f = 0; f < fundDateMaps.length; f++) {
    const navEntry = fundDateMaps[f].get(endKey);
    if (!navEntry) return null;
    total += fundUnits[f] * navEntry.nav;
  }

  return total;
}

// ============================================================================
// XIRR CALCULATION
// ============================================================================

function calculateXirr(
  investmentAmount: number,
  totalValue: number,
  startDate: Date,
  endDate: Date
): number | null {
  try {
    return xirr([
      { amount: -investmentAmount, when: startDate },
      { amount: totalValue, when: endDate }
    ]);
  } catch {
    return null;
  }
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

function buildBuySellTransactions(
  fundDateMaps: Map<string, NavEntry>[],
  fundUnits: number[],
  allocations: number[],
  startDate: Date,
  endDate: Date,
  investmentAmount: number
): Transaction[] {
  const transactions: Transaction[] = [];
  const startKey = toDateKey(startDate);
  const endKey = toDateKey(endDate);

  let startPortfolioValue = 0;
  let endPortfolioValue = 0;
  const sellTransactions: Transaction[] = [];

  for (let f = 0; f < fundDateMaps.length; f++) {
    const startEntry = fundDateMaps[f].get(startKey);
    const endEntry = fundDateMaps[f].get(endKey);
    if (!startEntry || !endEntry) continue;

    const allocation = (investmentAmount * allocations[f]) / 100;
    const currentValueStart = fundUnits[f] * startEntry.nav;
    const currentValueEnd = fundUnits[f] * endEntry.nav;

    startPortfolioValue += currentValueStart;
    endPortfolioValue += currentValueEnd;

    transactions.push({
      fundIdx: f,
      nav: startEntry.nav,
      when: startEntry.date,
      units: fundUnits[f],
      amount: -allocation,
      type: 'buy',
      cumulativeUnits: fundUnits[f],
      currentValue: currentValueStart,
      allocationPercentage: 0
    });

    sellTransactions.push({
      fundIdx: f,
      nav: endEntry.nav,
      when: endEntry.date,
      units: fundUnits[f],
      amount: currentValueEnd,
      type: 'sell',
      cumulativeUnits: fundUnits[f],
      currentValue: currentValueEnd,
      allocationPercentage: 0
    });
  }

  transactions.forEach(tx => tx.allocationPercentage = startPortfolioValue ? (tx.currentValue / startPortfolioValue) * 100 : 0);
  sellTransactions.forEach(tx => tx.allocationPercentage = endPortfolioValue ? (tx.currentValue / endPortfolioValue) * 100 : 0);

  transactions.push(...sellTransactions);
  return transactions;
}

// ============================================================================
// DETAILED DAILY TRANSACTIONS
// ============================================================================

function buildDetailedTransactions(
  fundDateMaps: Map<string, NavEntry>[],
  fundUnits: number[],
  allocations: number[],
  sorted: NavEntry[],
  startDate: Date,
  endDate: Date,
  investmentAmount: number
): Transaction[] {
  const transactions: Transaction[] = [];
  const startKey = toDateKey(startDate);
  const endKey = toDateKey(endDate);

  const periodDates = sorted.filter(d => d.date >= startDate && d.date <= endDate);

  for (const dateEntry of periodDates) {
    const dateKey = toDateKey(dateEntry.date);
    const isStart = dateKey === startKey;
    const isEnd = dateKey === endKey;
    let totalPortfolioValue = 0;
    const dayTransactions: Transaction[] = [];

    for (let f = 0; f < fundDateMaps.length; f++) {
      const navEntry = fundDateMaps[f].get(dateKey);
      if (!navEntry) continue;

      const currentValue = fundUnits[f] * navEntry.nav;
      totalPortfolioValue += currentValue;

      let type: 'buy' | 'sell' | 'nil' = 'nil';
      let amount = 0;
      let units = 0;

      if (isStart) {
        type = 'buy';
        amount = -(investmentAmount * allocations[f] / 100);
        units = fundUnits[f];
      } else if (isEnd) {
        type = 'sell';
        amount = currentValue;
        units = fundUnits[f];
      }

      dayTransactions.push({
        fundIdx: f,
        nav: navEntry.nav,
        when: navEntry.date,
        units,
        amount,
        type,
        cumulativeUnits: fundUnits[f],
        currentValue,
        allocationPercentage: 0
      });
    }

    dayTransactions.forEach(tx => tx.allocationPercentage = totalPortfolioValue ? (tx.currentValue / totalPortfolioValue) * 100 : 0);
    transactions.push(...dayTransactions);
  }

  return transactions;
}

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

export function calculateLumpSumRollingXirr(
  navDataList: NavEntry[][],
  years: number = 1,
  allocations: number[] = [],
  investmentAmount: number = 100,
  includeNilTransactions: boolean = false
): RollingXirrEntry[] {
  if (!isValidInput(navDataList)) return [];

  const numFunds = navDataList.length;
  const actualAllocations = allocations.length === numFunds ? allocations : Array(numFunds).fill(100 / numFunds);
  const filledNavs = navDataList.map(ensureContinuousDates);
  const fundDateMaps = filledNavs.map(buildDateMap);
  const sorted = getSortedDates(filledNavs[0]);
  const firstDate = sorted[0].date;
  const months = years * 12;

  // Precompute NAVs
  const allNavs: number[][] = [];
  sorted.forEach(entry => {
    const dateKey = toDateKey(entry.date);
    const navsForDate: number[] = [];
    for (let f = 0; f < numFunds; f++) {
      navsForDate.push(fundDateMaps[f].get(dateKey)?.nav ?? 0);
    }
    allNavs.push(navsForDate);
  });

  const dateIndexMap = new Map<string, number>();
  sorted.forEach((entry, idx) => dateIndexMap.set(toDateKey(entry.date), idx));

  const results: RollingXirrEntry[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const endDate = sorted[i].date;
    const startDate = getNthPreviousMonthDate(endDate, months);
    if (startDate < firstDate) continue;

    const startKey = toDateKey(startDate);
    const startIdx = dateIndexMap.get(startKey);
    if (startIdx === undefined) continue;

    const fundUnits = calculateFundUnits(fundDateMaps, startDate, actualAllocations, investmentAmount);
    if (!fundUnits) continue;

    const totalValue = calculateTotalValue(fundDateMaps, endDate, fundUnits);
    if (totalValue === null) continue;

    // Compute daily portfolio values for volatility
    const dailyValues: DailyPortfolioValue[] = [];
    const startNavs = allNavs[startIdx];
    for (let j = startIdx; j <= i; j++) {
      let pv = 0;
      for (let f = 0; f < numFunds; f++) {
        if (startNavs[f] > 0) pv += (actualAllocations[f] / 100) * (allNavs[j][f] / startNavs[f]) * investmentAmount;
      }
      dailyValues.push({ date: sorted[j].date, totalValue: pv });
    }

    results.push({
      date: endDate,
      xirr: Math.round((calculateXirr(investmentAmount, totalValue, startDate, endDate) ?? 0) * 10000) / 10000,
      transactions: includeNilTransactions
        ? buildDetailedTransactions(fundDateMaps, fundUnits, actualAllocations, sorted, startDate, endDate, investmentAmount)
        : buildBuySellTransactions(fundDateMaps, fundUnits, actualAllocations, startDate, endDate, investmentAmount),
      volatility: Math.round(calculateVolatility(dailyValues) * 10000) / 10000
    });
  }

  return results;
}
