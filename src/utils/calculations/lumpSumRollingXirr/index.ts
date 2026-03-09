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
// HELPERS
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
// FUND UNITS
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

// ============================================================================
// TOTAL VALUE
// ============================================================================

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
// CAGR RETURN
// ============================================================================

function calculateRollingReturn(
  investmentAmount: number,
  totalValue: number,
  years: number
): number {

  return Math.pow(totalValue / investmentAmount, 1 / years) - 1;
}

// ============================================================================
// DAILY PORTFOLIO SERIES
// ============================================================================

function buildDailyPortfolioValues(
  fundDateMaps: Map<string, NavEntry>[],
  fundUnits: number[],
  sortedDates: NavEntry[],
  startDate: Date,
  endIndex: number
): DailyPortfolioValue[] {

  const dailyValues: DailyPortfolioValue[] = [];

  for (let j = 0; j <= endIndex; j++) {

    const date = sortedDates[j].date;

    if (date < startDate) continue;

    const key = toDateKey(date);

    let portfolioValue = 0;

    for (let f = 0; f < fundDateMaps.length; f++) {

      const navEntry = fundDateMaps[f].get(key);
      if (!navEntry) continue;

      portfolioValue += fundUnits[f] * navEntry.nav;
    }

    dailyValues.push({
      date,
      totalValue: portfolioValue
    });
  }

  return dailyValues;
}

// ============================================================================
// MAIN FUNCTION
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

  const actualAllocations =
    allocations.length === numFunds
      ? allocations
      : Array(numFunds).fill(100 / numFunds);

  const filledNavs = navDataList.map(ensureContinuousDates);

  const fundDateMaps = filledNavs.map(buildDateMap);

  const sorted = getSortedDates(filledNavs[0]);

  const firstDate = sorted[0].date;

  const months = years * 12;

  const results: RollingXirrEntry[] = [];

  for (let i = 0; i < sorted.length; i++) {

    const endDate = sorted[i].date;

    const startDate = getNthPreviousMonthDate(endDate, months);

    if (startDate < firstDate) continue;

    const fundUnits = calculateFundUnits(
      fundDateMaps,
      startDate,
      actualAllocations,
      investmentAmount
    );

    if (!fundUnits) continue;

    const totalValue = calculateTotalValue(
      fundDateMaps,
      endDate,
      fundUnits
    );

    if (totalValue === null) continue;

    const dailyValues = buildDailyPortfolioValues(
      fundDateMaps,
      fundUnits,
      sorted,
      startDate,
      i
    );

    const volatility = calculateVolatility(dailyValues);

    const rollingReturn = calculateRollingReturn(
      investmentAmount,
      totalValue,
      years
    );

    results.push({

      date: endDate,

      xirr: Math.round(rollingReturn * 10000) / 10000,

      transactions: [],

      volatility: Math.round(volatility * 10000) / 10000
    });
  }

  return results;
}
