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
// PORTFOLIO VALUE
// ============================================================================

function calculatePortfolioValueForDate(
  fundDateMaps: Map<string, NavEntry>[],
  date: Date,
  units: number[]
): number | null {

  let total = 0;
  const key = toDateKey(date);

  for (let f = 0; f < fundDateMaps.length; f++) {

    const navEntry = fundDateMaps[f].get(key);
    if (!navEntry) return null;

    total += units[f] * navEntry.nav;
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
// MAIN FUNCTION
// ============================================================================

export function calculateLumpSumRollingXirr(

  navDataList: NavEntry[][],
  years: number = 1,
  allocations: number[] = [],
  investmentAmount: number = 100

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

    const totalValue = calculatePortfolioValueForDate(
      fundDateMaps,
      endDate,
      fundUnits
    );

    if (totalValue === null) continue;

    // volatility window fix
    const dailyValues: DailyPortfolioValue[] = [];

    for (let j = 0; j <= i; j++) {

      const day = sorted[j].date;

      if (day < startDate) continue;

      const value = calculatePortfolioValueForDate(
        fundDateMaps,
        day,
        fundUnits
      );

      if (value !== null) {
        dailyValues.push({
          date: day,
          totalValue: value
        });
      }
    }

    results.push({
      date: endDate,
      xirr:
        Math.round(
          calculateRollingReturn(investmentAmount, totalValue, years) * 10000
        ) / 10000,
      transactions: [],
      volatility:
        Math.round(calculateVolatility(dailyValues) * 10000) / 10000
    });
  }

  return results;
}

// ============================================================================
// RECALCULATE TRANSACTIONS FOR MODAL
// ============================================================================

/**
 * Recalculate lumpsum transactions for a specific date (for modal display).
 * Returns one buy transaction per fund at the start of the rolling period.
 *
 * @param navDataList - Array of NAV data for each fund
 * @param targetDate - The specific date to recalculate for
 * @param years - Rolling period in years
 * @param allocations - Allocation percentages for each fund
 * @param investmentAmount - Total lumpsum investment amount
 * @returns Transaction array (one buy per fund), or null if calculation fails
 */
export function recalculateLumpsumTransactionsForDate(
  navDataList: NavEntry[][],
  targetDate: Date,
  years: number,
  allocations: number[],
  investmentAmount: number
): Transaction[] | null {
  if (!isValidInput(navDataList)) return null;

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
  const startDate = getNthPreviousMonthDate(targetDate, months);

  if (startDate < firstDate) return null;

  const fundUnits = calculateFundUnits(
    fundDateMaps,
    startDate,
    actualAllocations,
    investmentAmount
  );

  if (!fundUnits) return null;

  const transactions: Transaction[] = [];
  const startKey = toDateKey(startDate);
  const targetKey = toDateKey(targetDate);

  for (let f = 0; f < numFunds; f++) {
    const navEntry = fundDateMaps[f].get(startKey);
    const targetNavEntry = fundDateMaps[f].get(targetKey);
    if (!navEntry || !targetNavEntry) return null;

    const allocationAmount = (investmentAmount * actualAllocations[f]) / 100;
    const units = fundUnits[f];
    const currentValue = units * targetNavEntry.nav;

    transactions.push({
      fundIdx: f,
      when: startDate,
      nav: navEntry.nav,
      units,
      amount: allocationAmount,
      type: 'buy',
      cumulativeUnits: units,
      currentValue,
      allocationPercentage: actualAllocations[f]
    });
  }

  return transactions;
}
