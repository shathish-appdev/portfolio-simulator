import { calculateLumpSumRollingXirr, RollingXirrEntry } from './index';
import { NavEntry } from '../../../types/navData';
import { fillMissingNavDates } from '../../data/fillMissingNavDates';

describe('calculateLumpSumRollingXirr', () => {
  it('calculates lump sum rolling 1-year XIRR for simple NAV data', () => {
    const navData: NavEntry[] = [
      { date: new Date('2023-01-31'), nav: 100 },
      { date: new Date('2024-01-31'), nav: 120 },
      { date: new Date('2025-01-31'), nav: 140 },
    ];
    const filled = fillMissingNavDates(navData);
    const result = calculateLumpSumRollingXirr([filled]);
    // Find the results for the specific dates of interest
    const r2024 = result.find(r => r.date.getTime() === new Date('2024-01-31').getTime());
    const r2025 = result.find(r => r.date.getTime() === new Date('2025-01-31').getTime());
    expect(r2024).toBeDefined();
    expect(r2024!.xirr).toBeCloseTo(0.2, 3);
    expect(r2025).toBeDefined();
    expect(r2025!.xirr).toBeCloseTo(0.1667, 2);
  });

  it('returns empty array if not enough data', () => {
    expect(calculateLumpSumRollingXirr([fillMissingNavDates([])])).toEqual([]);
    expect(calculateLumpSumRollingXirr([fillMissingNavDates([{ date: new Date('2023-01-01'), nav: 100 }])])).toEqual([]);
  });

  it('skips dates where no suitable start date exists', () => {
    const navData: NavEntry[] = [
      { date: new Date('2023-01-31'), nav: 100 },
      { date: new Date('2023-06-30'), nav: 110 },
      { date: new Date('2024-07-31'), nav: 130 },
    ];
    const filled = fillMissingNavDates(navData);
    const result = calculateLumpSumRollingXirr([filled]);
    // Only 2024-07-31 should have a valid 1-year-back date (2023-07-31, which will be filled)
    expect(result.length).toBeGreaterThanOrEqual(1);
    // The first result should be for 2024-07-31
    expect(result.some(r => r.date.getTime() === new Date('2024-07-31').getTime())).toBe(true);
  });

  it('respects custom allocations for multiple funds', () => {
    const navData1: NavEntry[] = [
      { date: new Date('2023-01-31'), nav: 100 },
      { date: new Date('2024-01-31'), nav: 150 }, // 50% gain
    ];
    const navData2: NavEntry[] = [
      { date: new Date('2023-01-31'), nav: 100 },
      { date: new Date('2024-01-31'), nav: 110 }, // 10% gain
    ];
    const filled1 = fillMissingNavDates(navData1);
    const filled2 = fillMissingNavDates(navData2);
    
    // 70% in fund1 (high return), 30% in fund2 (low return)
    const result = calculateLumpSumRollingXirr([filled1, filled2], 1, [70, 30], 100);
    const r2024 = result.find(r => r.date.getTime() === new Date('2024-01-31').getTime());
    
    expect(r2024).toBeDefined();
    // Expected: 70 grows to 105, 30 grows to 33 → Total: 138 from 100
    expect(r2024!.xirr).toBe(0.38);
  });

  it('defaults to equal allocation when allocations not provided', () => {
    const navData1: NavEntry[] = [
      { date: new Date('2023-01-31'), nav: 100 },
      { date: new Date('2024-01-31'), nav: 150 },
    ];
    const navData2: NavEntry[] = [
      { date: new Date('2023-01-31'), nav: 100 },
      { date: new Date('2024-01-31'), nav: 110 },
    ];
    const filled1 = fillMissingNavDates(navData1);
    const filled2 = fillMissingNavDates(navData2);
    
    // No allocations provided - should split 50-50
    const result = calculateLumpSumRollingXirr([filled1, filled2], 1, [], 100);
    const r2024 = result.find(r => r.date.getTime() === new Date('2024-01-31').getTime());
    
    expect(r2024).toBeDefined();
    // Expected: 50 grows to 75, 50 grows to 55 → Total: 130 from 100
    expect(r2024!.xirr).toBe(0.3);
  });

  it('calculates correct corpus value with custom allocations', () => {
    const navData: NavEntry[] = [
      { date: new Date('2023-01-31'), nav: 10 },
      { date: new Date('2024-01-31'), nav: 20 }, // 2x
    ];
    const filled = fillMissingNavDates(navData);
    
    const result = calculateLumpSumRollingXirr([filled], 1, [100], 50000);
    const r2024 = result.find(r => r.date.getTime() === new Date('2024-01-31').getTime());
    
    expect(r2024).toBeDefined();
    expect(r2024!.xirr).toBe(1); // 100% return (50k → 100k)
  });

  it('calculates volatility for lumpsum investment', () => {
    const navData: NavEntry[] = [
      { date: new Date('2023-01-01'), nav: 100 },
      { date: new Date('2023-01-02'), nav: 105 }, // +5%
      { date: new Date('2023-01-03'), nav: 102 }, // -2.86%
      { date: new Date('2023-01-04'), nav: 108 }, // +5.88%
      { date: new Date('2023-01-05'), nav: 104 }, // -3.70%
      { date: new Date('2024-01-01'), nav: 110 },
    ];
    const filled = fillMissingNavDates(navData);
    
    const result = calculateLumpSumRollingXirr([filled], 1, [100], 100);
    const r2024 = result.find(r => r.date.getTime() === new Date('2024-01-01').getTime());
    
    expect(r2024).toBeDefined();
    expect(r2024!.volatility).toBe(9.7161);
  });

  it('calculates correct volatility for multi-fund portfolios', () => {
    const fund1: NavEntry[] = [
      { date: new Date('2023-01-01'), nav: 100 },
      { date: new Date('2023-01-02'), nav: 110 }, // +10%
      { date: new Date('2023-01-03'), nav: 108 }, // -1.82%
      { date: new Date('2024-01-01'), nav: 120 },
    ];
    const fund2: NavEntry[] = [
      { date: new Date('2023-01-01'), nav: 50 },
      { date: new Date('2023-01-02'), nav: 51 }, // +2%
      { date: new Date('2023-01-03'), nav: 52 }, // +1.96%
      { date: new Date('2024-01-01'), nav: 55 },
    ];
    const filled1 = fillMissingNavDates(fund1);
    const filled2 = fillMissingNavDates(fund2);
    
    const result = calculateLumpSumRollingXirr([filled1, filled2], 1, [50, 50], 100000);
    const r2024 = result.find(r => r.date.getTime() === new Date('2024-01-01').getTime());
    
    expect(r2024).toBeDefined();
    // With 50-50 allocation, portfolio value at each date:
    // Day 0: 100,000 (50k in each fund)
    // Day 1: 50k*(110/100) + 50k*(51/50) = 55k + 51k = 106k
    // Day 2: 50k*(108/100) + 50k*(52/50) = 54k + 52k = 106k
    // Volatility should be calculated from these multi-fund portfolio values
    expect(r2024!.volatility).toBeGreaterThan(0);
    expect(r2024!.volatility).toBeLessThan(20); // Reasonable range for volatility
  });

  it('skips forward-filled weekends in volatility calculation', () => {
    // 5 trading days with changes, rest are forward-filled (same value)
    const navData: NavEntry[] = [
      { date: new Date('2023-01-01'), nav: 100 },
      { date: new Date('2023-01-02'), nav: 102 }, // +2%
      { date: new Date('2023-01-03'), nav: 102 }, // 0% (forward-filled, should skip)
      { date: new Date('2023-01-04'), nav: 102 }, // 0% (forward-filled, should skip)
      { date: new Date('2023-01-05'), nav: 104 }, // +1.96%
      { date: new Date('2024-01-01'), nav: 110 },
    ];
    const filled = fillMissingNavDates(navData);
    
    const result = calculateLumpSumRollingXirr([filled], 1, [100], 100);
    const r2024 = result.find(r => r.date.getTime() === new Date('2024-01-01').getTime());
    
    expect(r2024).toBeDefined();
    // Volatility calculated only from non-zero return days (weekends skipped)
    expect(r2024!.volatility).toBe(3.0937);
  });
}); 