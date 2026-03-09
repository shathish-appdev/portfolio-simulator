import { NavEntry } from '../../../types/navData';
import { areDatesContinuous } from '../../date/dateUtils';
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
// FUND UNITS (Buy once at start date)
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
// TOTAL PORTFOLIO VALUE
// ============================================================================

function calculateTotalValue(
  fundDateMaps: Map<string, NavEntry>[],
  date: Date,
  fundUnits: number[]
): number {

  let total = 0;

  const dateKey = toDateKey(date);

  for (let f = 0; f < fundDateMaps.length; f++) {

    const navEntry = fundDateMaps[f].get(dateKey);

    if (!navEntry) continue;

    total += fundUnits[f] * navEntry.nav;
  }

  return total;
}

// ============================================================================
// GOOGLE FINANCE RETURN
// ============================================================================

function calculateReturn(
  investmentAmount: number,
  totalValue: number
): number {

  return (totalValue / investmentAmount) - 1;
}

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

export function calculateLumpSumRollingXirr(

  navDataList: NavEntry[][],
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

  const startDate = sorted[0].date;

  const fundUnits = calculateFundUnits(
    fundDateMaps,
    startDate,
    actualAllocations,
    investmentAmount
  );

  if (!fundUnits) return [];

  const results: RollingXirrEntry[] = [];

  const dailyValues: DailyPortfolioValue[] = [];

  for (let i = 0; i < sorted.length; i++) {

    const date = sorted[i].date;

    const totalValue = calculateTotalValue(
      fundDateMaps,
      date,
      fundUnits
    );

    const returnValue = calculateReturn(
      investmentAmount,
      totalValue
    );

    dailyValues.push({
      date,
      totalValue
    });

    results.push({

      date,

      xirr:
        Math.round(returnValue * 10000) / 10000,

      transactions: [],

      volatility:
        Math.round(calculateVolatility(dailyValues) * 10000) / 10000

    });

  }

  return results;
}
