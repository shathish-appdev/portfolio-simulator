import { MILLISECONDS_PER_DAY } from '../../constants';

/** Synthetic ticker: units = USD dollars; value is flat at $1 per unit over time. */
export const USD_CASH_TICKER = '~USD';

export function isUsdCashTicker(ticker: string): boolean {
  return ticker.trim().toUpperCase() === USD_CASH_TICKER;
}

function filterSeriesInRange(arr: Array<{ date: Date; nav: number }>, start: Date, end: Date): Array<{ date: Date; nav: number }> {
  return arr.filter((p) => p.date >= start && p.date <= end).sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** UTC midnight timestamps for each calendar day from start through end (inclusive). */
export function eachDayUtcTimestamps(start: Date, end: Date): number[] {
  const out: number[] = [];
  const s = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  for (let t = s; t <= e; t += MILLISECONDS_PER_DAY) {
    out.push(t);
  }
  return out;
}

/**
 * Trading dates from Yahoo series (non-cash). If none (cash-only portfolio), use daily UTC dates in range.
 */
export function collectSortedTimes(
  holdings: Array<{ ticker: string; units: number }>,
  perTicker: Map<string, Array<{ date: Date; nav: number }>>,
  start: Date,
  end: Date
): number[] {
  const dateSet = new Set<number>();
  for (const h of holdings) {
    if (isUsdCashTicker(h.ticker)) continue;
    const series = perTicker.get(h.ticker);
    if (!series) continue;
    filterSeriesInRange(series, start, end).forEach((p) => dateSet.add(p.date.getTime()));
  }
  if (dateSet.size > 0) {
    return Array.from(dateSet).sort((a, b) => a - b);
  }
  return eachDayUtcTimestamps(start, end);
}

export function buildNetWorthSeries(
  holdings: Array<{ ticker: string; units: number }>,
  perTicker: Map<string, Array<{ date: Date; nav: number }>>,
  start: Date,
  end: Date
): Array<{ date: Date; nav: number }> {
  const active = holdings.filter(
    (h) => h.ticker && h.units > 0 && (isUsdCashTicker(h.ticker) || perTicker.has(h.ticker))
  );
  if (active.length === 0) return [];

  const sortedTimes = collectSortedTimes(holdings, perTicker, start, end);
  if (sortedTimes.length === 0) return [];

  const sortedSeries = new Map<string, Array<{ date: Date; nav: number }>>();
  perTicker.forEach((arr, sym) => {
    if (isUsdCashTicker(sym)) return;
    sortedSeries.set(sym, filterSeriesInRange(arr, start, end));
  });

  const result: Array<{ date: Date; nav: number }> = [];
  const indices = new Map<string, number>();
  const lastPrice = new Map<string, number>();
  active.forEach((h) => {
    if (!isUsdCashTicker(h.ticker)) indices.set(h.ticker, 0);
  });

  for (const t of sortedTimes) {
    let allStocksReady = true;
    for (const h of active) {
      if (isUsdCashTicker(h.ticker)) continue;
      const series = sortedSeries.get(h.ticker)!;
      let idx = indices.get(h.ticker)!;
      while (idx < series.length && series[idx].date.getTime() <= t) {
        lastPrice.set(h.ticker, series[idx].nav);
        idx++;
      }
      indices.set(h.ticker, idx);
      if (lastPrice.get(h.ticker) === undefined) allStocksReady = false;
    }
    if (!allStocksReady) continue;
    let total = 0;
    for (const h of active) {
      if (isUsdCashTicker(h.ticker)) {
        total += h.units * 1;
      } else {
        total += h.units * lastPrice.get(h.ticker)!;
      }
    }
    result.push({ date: new Date(t), nav: total });
  }

  return result;
}

export type PerTickerSeries = { ticker: string; data: Array<{ date: Date; nav: number }> };

/** Market value of each holding over time (USD); cash uses constant $1 per unit. */
export function buildPerTickerValueSeries(
  holdings: Array<{ ticker: string; units: number }>,
  perTicker: Map<string, Array<{ date: Date; nav: number }>>,
  start: Date,
  end: Date
): PerTickerSeries[] {
  const active = holdings.filter(
    (h) => h.ticker && h.units > 0 && (isUsdCashTicker(h.ticker) || perTicker.has(h.ticker))
  );
  if (active.length === 0) return [];

  const sortedTimes = collectSortedTimes(holdings, perTicker, start, end);
  if (sortedTimes.length === 0) return [];

  const sortedSeries = new Map<string, Array<{ date: Date; nav: number }>>();
  perTicker.forEach((arr, sym) => {
    if (isUsdCashTicker(sym)) return;
    sortedSeries.set(sym, filterSeriesInRange(arr, start, end));
  });

  const indices = new Map<string, number>();
  const lastPrice = new Map<string, number>();
  active.forEach((h) => {
    if (!isUsdCashTicker(h.ticker)) indices.set(h.ticker, 0);
  });

  const buckets = new Map<string, Array<{ date: Date; nav: number }>>();
  active.forEach((h) => buckets.set(h.ticker, []));

  for (const t of sortedTimes) {
    let allStocksReady = true;
    for (const h of active) {
      if (isUsdCashTicker(h.ticker)) continue;
      const series = sortedSeries.get(h.ticker)!;
      let idx = indices.get(h.ticker)!;
      while (idx < series.length && series[idx].date.getTime() <= t) {
        lastPrice.set(h.ticker, series[idx].nav);
        idx++;
      }
      indices.set(h.ticker, idx);
      if (lastPrice.get(h.ticker) === undefined) allStocksReady = false;
    }
    if (!allStocksReady) continue;

    for (const h of active) {
      const val = isUsdCashTicker(h.ticker) ? h.units * 1 : h.units * lastPrice.get(h.ticker)!;
      buckets.get(h.ticker)!.push({ date: new Date(t), nav: val });
    }
  }

  return active.map((h) => ({
    ticker: legendLabelForTicker(h.ticker),
    data: buckets.get(h.ticker)!,
  }));
}

/** Legend label: friendlier name for synthetic cash. */
export function legendLabelForTicker(ticker: string): string {
  if (isUsdCashTicker(ticker)) return 'USD cash';
  return ticker;
}

/**
 * Rebase each holding’s value series so the first point is 100 (compare relative performance).
 * Skips rebasing when the first value is missing or zero.
 */
export function normalizePerTickerSeriesTo100(series: PerTickerSeries[]): PerTickerSeries[] {
  return series.map((s) => {
    const first = s.data[0]?.nav;
    if (first === undefined || first === 0 || !Number.isFinite(first)) {
      return { ticker: s.ticker, data: s.data.map((p) => ({ date: p.date, nav: p.nav })) };
    }
    return {
      ticker: s.ticker,
      data: s.data.map((p) => ({ date: p.date, nav: (p.nav / first) * 100 })),
    };
  });
}

export function mergeHoldingsByTicker(holdings: Array<{ ticker: string; units: number }>): Array<{ ticker: string; units: number }> {
  const map = new Map<string, number>();
  for (const h of holdings) {
    map.set(h.ticker, (map.get(h.ticker) ?? 0) + h.units);
  }
  return Array.from(map.entries()).map(([ticker, units]) => ({ ticker, units }));
}
