import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { Input } from 'baseui/input';
import { Table } from 'baseui/table-semantic';
import { LabelMedium, ParagraphSmall } from 'baseui/typography';
import Highcharts from 'highcharts/esm/highcharts';
import 'highcharts/esm/modules/heatmap';
import HighchartsReact from 'highcharts-react-official';
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadingOverlay } from '../components/common/LoadingOverlay';
import { PageCard, PageIntro } from '../components/common/PageChrome';
import { StockPriceChart } from '../components/charts/StockPriceChart';
import { COLORS } from '../constants';
import { yahooFinanceService } from '../services/yahooFinanceService';
import { splitTickerAmountSegment } from '../utils/browser/tickerAmountUrl';
import { fillMissingNavDates } from '../utils/data/fillMissingNavDates';

/* ─────────────── helpers ─────────────── */

function getPriceAtDate(data: Array<{ date: Date; nav: number }>, targetDate: Date): number {
  const t = targetDate.getTime();
  let last = data[0];
  for (const p of data) {
    if (p.date.getTime() <= t) last = p;
    else break;
  }
  return last.nav;
}

function getMonthsBetween(startMonth: string, endMonth: string): string[] {
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  const months: string[] = [];
  for (let y = sy; y <= ey; y++) {
    const mStart = y === sy ? sm : 1;
    const mEnd = y === ey ? em : 12;
    for (let m = mStart; m <= mEnd; m++) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
    }
  }
  return months;
}

function monthToStartDate(monthStr: string): string {
  return `${monthStr}-01`;
}

function monthToEndDate(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${monthStr}-${String(lastDay).padStart(2, '0')}`;
}

function addMonths(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatDateAsMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function downloadJsonFile(payload: unknown, filename: string): void {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function parseSyntheticTicker(ticker: string): { rate: number } | null {
  const t = ticker.trim().toUpperCase();
  if (!t.startsWith('~')) return null;
  if (t === '~TARGET_RATE') return { rate: 0.12 };
  const match = t.match(/^~TARGET_RATE:(\d+(?:\.\d+)?)$/);
  if (match) return { rate: parseFloat(match[1]) / 100 };
  const numMatch = t.match(/^~(\d+(?:\.\d+)?)$/);
  if (numMatch) return { rate: parseFloat(numMatch[1]) / 100 };
  return null;
}

function generateSyntheticPriceData(
  startDateStr: string,
  endDateStr: string,
  xirrRate: number
): Array<{ date: Date; nav: number }> {
  const start = new Date(startDateStr + 'T00:00:00Z');
  const end = new Date(endDateStr + 'T23:59:59Z');
  const result: Array<{ date: Date; nav: number }> = [];
  const msPerDay = 86400000;

  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setTime(d.getTime() + msPerDay)) {
    const daysSinceStart = (d.getTime() - start.getTime()) / msPerDay;
    const years = daysSinceStart / 365.25;
    const nav = Math.pow(1 + xirrRate, years);
    result.push({
      date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
      nav,
    });
  }
  return result;
}

function defaultStartMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 11);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function defaultEndMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function clampDurationMonths(value: number, fallback = 1): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(12, Math.max(1, Math.floor(value)));
}

function getDurationBuckets(durationFrom: number, durationTo: number): number[] {
  const from = Math.min(durationFrom, durationTo);
  const to = Math.max(durationFrom, durationTo);
  const buckets: number[] = [];
  for (let d = from; d <= to; d++) buckets.push(d);
  return buckets;
}

/* ─────────────── types ─────────────── */

interface PortfolioEntry {
  id: string;
  ticker: string;
  amount: string; // total amount for comparison
}

const INITIAL_ENTRIES: PortfolioEntry[] = [{ id: '1', ticker: '', amount: '' }];

/* ─────────────── URL serialization ─────────────── */

function parseCompareParams(searchParams: URLSearchParams): {
  entries: PortfolioEntry[];
  startMonth: string;
  endMonth: string;
  durationFrom: number;
  durationTo: number;
} | null {
  const p = searchParams.get('p');
  const pa = searchParams.get('pa');
  const pb = searchParams.get('pb');
  const startMonth = searchParams.get('startMonth');
  const endMonth = searchParams.get('endMonth');
  const durationFromRaw = searchParams.get('durationFrom');
  const durationToRaw = searchParams.get('durationTo');
  const simulationStepMonthsRaw = searchParams.get('simulationStepMonths');
  if (!p && !pa && !pb && !startMonth && !endMonth && !durationFromRaw && !durationToRaw && !simulationStepMonthsRaw) {
    return null;
  }

  const parseEntries = (s: string | null): PortfolioEntry[] => {
    if (!s?.trim()) return [{ id: crypto.randomUUID?.() ?? String(Date.now()), ticker: '', amount: '' }];
    const parsed = s.split(',').map((part) => {
      const { ticker, amount } = splitTickerAmountSegment(part);
      return {
        id: crypto.randomUUID?.() ?? String(Date.now() + Math.random()),
        ticker: ticker.toUpperCase(),
        amount: amount.replace(/[^0-9.]/g, ''),
      };
    }).filter((e) => e.ticker || e.amount);
    return parsed.length ? parsed : [{ id: crypto.randomUUID?.() ?? String(Date.now()), ticker: '', amount: '' }];
  };

  const rawHoldings = [p, pa, pb].find((s) => s?.trim()) ?? null;
  const entries = parseEntries(rawHoldings);

  const legacyStep = simulationStepMonthsRaw != null ? clampDurationMonths(Number(simulationStepMonthsRaw), 1) : null;
  const durationFrom = clampDurationMonths(
    durationFromRaw != null ? Number(durationFromRaw) : (legacyStep ?? 1),
    1
  );
  const durationTo = clampDurationMonths(
    durationToRaw != null ? Number(durationToRaw) : (legacyStep ?? durationFrom),
    durationFrom
  );

  return {
    entries: entries.length ? entries : [{ id: crypto.randomUUID?.() ?? '1', ticker: '', amount: '' }],
    startMonth: startMonth && /^\d{4}-\d{2}$/.test(startMonth) ? startMonth : defaultStartMonth(),
    endMonth: endMonth && /^\d{4}-\d{2}$/.test(endMonth) ? endMonth : defaultEndMonth(),
    durationFrom: Math.min(durationFrom, durationTo),
    durationTo: Math.max(durationFrom, durationTo),
  };
}

function serializeCompareParams(
  entries: PortfolioEntry[],
  startMonth: string,
  endMonth: string,
  durationFrom: number,
  durationTo: number
): URLSearchParams {
  const params = new URLSearchParams();
  const str = entries
    .filter((e) => e.ticker.trim() || parseFloat(e.amount) > 0)
    .map((e) => `${e.ticker}:${e.amount}`)
    .join(',');
  if (str) params.set('p', str);
  params.set('startMonth', startMonth);
  params.set('endMonth', endMonth);
  params.set('durationFrom', String(Math.min(durationFrom, durationTo)));
  params.set('durationTo', String(Math.max(durationFrom, durationTo)));
  return params;
}

function hasValidCompareEntries(entries: PortfolioEntry[]): boolean {
  return entries.some((e) => e.ticker.trim() && parseFloat(e.amount) > 0);
}

/* ─────────────── UI Styles ─────────────── */

const dateInputStyle = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '14px',
  fontFamily: 'inherit' as const,
  backgroundColor: '#fff',
};

/* ─────────────── Holdings (tickers + amounts) ─────────────── */

function HoldingsSection({
  entries,
  onUpdate,
  onAddRow,
  onRemoveRow,
}: {
  entries: PortfolioEntry[];
  onUpdate: (id: string, field: 'ticker' | 'amount', value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
}) {
  return (
    <Block
      padding="scale500"
      marginBottom="scale400"
      backgroundColor="backgroundSecondary"
      overrides={{
        Block: {
          style: ({ $theme }) => ({
            borderRadius: $theme.borders.radius300,
            border: `1px solid ${$theme.colors.borderOpaque}`,
          }),
        },
      }}
    >
      <LabelMedium marginBottom="scale300" $style={{ fontWeight: 600 }}>
        Holdings
      </LabelMedium>
      <Block display="flex" flexDirection="column" gridGap="scale300">
        {entries.map((entry) => (
          <Block key={entry.id} display="flex" alignItems="center" gridGap="scale300" $style={{ flexWrap: 'wrap' }}>
            <Input
              value={entry.ticker}
              onChange={(e) => onUpdate(entry.id, 'ticker', (e.target as HTMLInputElement).value)}
              placeholder="Ticker (e.g. AAPL, ~12)"
              size="compact"
              overrides={{ Root: { style: { width: '140px', minWidth: '120px' } } }}
            />
            <LabelMedium marginBottom="0" marginTop="0">Total $</LabelMedium>
            <Input
              value={entry.amount}
              onChange={(e) => onUpdate(entry.id, 'amount', (e.target as HTMLInputElement).value.replace(/[^0-9.]/g, ''))}
              placeholder="Total Amount"
              size="compact"
              overrides={{ Root: { style: { width: '120px', minWidth: '100px' } } }}
            />
            <Button kind="tertiary" size="mini" onClick={() => onRemoveRow(entry.id)} disabled={entries.length <= 1}>
              Remove
            </Button>
          </Block>
        ))}
        <Button kind="secondary" size="compact" onClick={onAddRow}>
          + Add stock
        </Button>
      </Block>
    </Block>
  );
}

/* ─────────────── Main Component ─────────────── */

export default function LumpsumSipCompare(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();

  const [entries, setEntries] = useState<PortfolioEntry[]>(() => {
    const parsed = parseCompareParams(searchParams);
    if (parsed) return parsed.entries;
    return INITIAL_ENTRIES.map((e) => ({ ...e, id: crypto.randomUUID?.() ?? String(Date.now() + Math.random()) }));
  });
  const [priceDataByTicker, setPriceDataByTicker] = useState<
    Record<string, Array<{ date: Date; nav: number }>>
  >({});
  const [loading, setLoading] = useState(false);
  const [startMonth, setStartMonth] = useState<string>(() => {
    const parsed = parseCompareParams(searchParams);
    return parsed?.startMonth ?? defaultStartMonth();
  });
  const [endMonth, setEndMonth] = useState<string>(() => {
    const parsed = parseCompareParams(searchParams);
    return parsed?.endMonth ?? defaultEndMonth();
  });
  const [durationFrom, setDurationFrom] = useState<number>(() => {
    const parsed = parseCompareParams(searchParams);
    return parsed?.durationFrom ?? 1;
  });
  const [durationTo, setDurationTo] = useState<number>(() => {
    const parsed = parseCompareParams(searchParams);
    return parsed?.durationTo ?? 1;
  });
  const [hasResults, setHasResults] = useState(false);

  const runPriceFetch = useCallback(
    async (holdings: PortfolioEntry[], sm: string, em: string) => {
      const startDateStr = monthToStartDate(sm);
      const endDateStr = monthToEndDate(em);

      const allValid = holdings
        .filter((e) => e.ticker.trim() && parseFloat(e.amount) > 0)
        .map((e) => e.ticker.trim().toUpperCase());
      const uniqueTickers = [...new Set(allValid)];

      const realTickers = uniqueTickers.filter((t) => !parseSyntheticTicker(t));
      const syntheticTickers = uniqueTickers
        .map((t) => ({ ticker: t, parsed: parseSyntheticTicker(t) }))
        .filter((x): x is { ticker: string; parsed: { rate: number } } => x.parsed != null);

      const byTicker: Record<string, Array<{ date: Date; nav: number }>> = {};

      if (realTickers.length > 0) {
        const results = await Promise.allSettled(
          realTickers.map((t) => yahooFinanceService.fetchStockData(t, { startDate: startDateStr, endDate: endDateStr }))
        );
        results.forEach((result, i) => {
          if (result.status === 'fulfilled') {
            byTicker[realTickers[i]] = fillMissingNavDates(result.value);
          }
        });
      }

      syntheticTickers.forEach(({ ticker, parsed: syn }) => {
        byTicker[ticker] = generateSyntheticPriceData(startDateStr, endDateStr, syn.rate);
      });

      return byTicker;
    },
    []
  );

  useEffect(() => {
    const parsed = parseCompareParams(searchParams);
    if (!parsed) {
      setLoading(false);
      setHasResults(false);
      setPriceDataByTicker({});
      return;
    }

    setEntries(parsed.entries);
    setStartMonth(parsed.startMonth);
    setEndMonth(parsed.endMonth);
    setDurationFrom(parsed.durationFrom);
    setDurationTo(parsed.durationTo);

    if (!hasValidCompareEntries(parsed.entries) || parsed.startMonth > parsed.endMonth) {
      setPriceDataByTicker({});
      setHasResults(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setPriceDataByTicker({});
    setHasResults(false);

    void (async () => {
      try {
        const byTicker = await runPriceFetch(parsed.entries, parsed.startMonth, parsed.endMonth);
        if (cancelled) return;
        setPriceDataByTicker(byTicker);
        setHasResults(true);
      } catch (error) {
        console.error('Error fetching stock prices:', error);
        if (!cancelled) {
          setPriceDataByTicker({});
          setHasResults(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams.toString(), runPriceFetch]);

  const isRangeInvalid = startMonth > endMonth;
  const isDurationInvalid =
    !Number.isFinite(durationFrom) ||
    !Number.isFinite(durationTo) ||
    durationFrom < 1 ||
    durationTo < 1 ||
    durationFrom > 12 ||
    durationTo > 12;

  const allValidEntries = entries.filter((e) => e.ticker.trim() && parseFloat(e.amount) > 0);
  const hasValidEntries = allValidEntries.length > 0;
  const uniqueTickers = [...new Set(allValidEntries.map((e) => e.ticker.trim().toUpperCase()))];

  const handleAddRow = () => {
    setEntries((prev) => [...prev, { id: crypto.randomUUID?.() ?? String(Date.now()), ticker: '', amount: '' }]);
  };

  const handleRemoveRow = (entryId: string) => {
    setEntries((prev) => (prev.length > 1 ? prev.filter((e) => e.id !== entryId) : prev));
  };

  const handleUpdateEntry = (entryId: string, field: 'ticker' | 'amount', value: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, [field]: field === 'ticker' ? value.toUpperCase() : value.replace(/[^0-9.]/g, '') }
          : e
      )
    );
  };

  const handleCompare = () => {
    if (!hasValidEntries || isRangeInvalid || isDurationInvalid) return;
    setSearchParams(
      serializeCompareParams(entries, startMonth, endMonth, durationFrom, durationTo),
      { replace: true }
    );
  };

  const months = getMonthsBetween(startMonth, endMonth);
  const durationBuckets = getDurationBuckets(
    clampDurationMonths(durationFrom, 1),
    clampDurationMonths(durationTo, 1)
  );

  /* ─────────────── Compute Results ─────────────── */

  const winnerGridResult = (() => {
    const validEntries = entries.filter((e) => e.ticker.trim() && parseFloat(e.amount) > 0);
    if (validEntries.length === 0) {
      return {
        durationBuckets: [] as number[],
        endMonths: [] as string[],
        combinations: [] as Array<{
          endMonth: string;
          durationMonths: number;
          startMonth: string;
          lumpsumEndValue: number;
          sipEndValue: number;
          winner: 'Lumpsum' | 'SIP' | 'Tie';
          advantage: number;
        }>,
        summaryByDuration: [] as Array<{
          durationMonths: number;
          windows: number;
          lumpsumWins: number;
          sipWins: number;
          ties: number;
          avgLumpsumEndValue: number;
          avgSipEndValue: number;
        }>,
      };
    }

    const combinations: Array<{
      endMonth: string;
      durationMonths: number;
      startMonth: string;
      lumpsumEndValue: number;
      sipEndValue: number;
      winner: 'Lumpsum' | 'SIP' | 'Tie';
      advantage: number;
    }> = [];

    months.forEach((candidateEndMonth) => {
      durationBuckets.forEach((durationMonths) => {
        const windowStartMonth = addMonths(candidateEndMonth, -(durationMonths - 1));
        if (windowStartMonth < startMonth) return;
        const windowMonths = getMonthsBetween(windowStartMonth, candidateEndMonth);
        if (windowMonths.length !== durationMonths) return;

        const lumpsumInvestDate = new Date(windowStartMonth + '-01T12:00:00Z');
        const endDate = new Date(monthToEndDate(candidateEndMonth) + 'T23:59:59Z');

        let lumpsumEndValue = 0;
        let sipEndValue = 0;

        validEntries.forEach((e) => {
          const ticker = e.ticker.trim().toUpperCase();
          const totalAmt = parseFloat(e.amount) || 0;
          const data = priceDataByTicker[ticker];
          if (!data || data.length === 0 || totalAmt <= 0) return;

          const lumpsumStartPrice = getPriceAtDate(data, lumpsumInvestDate);
          const endPrice = getPriceAtDate(data, endDate);
          if (lumpsumStartPrice > 0) {
            const units = totalAmt / lumpsumStartPrice;
            lumpsumEndValue += units * endPrice;
          }

          const monthlyAmount = totalAmt / durationMonths;
          let sipUnits = 0;
          windowMonths.forEach((monthStr) => {
            const sipInvestDate = new Date(monthStr + '-01T12:00:00Z');
            const sipPrice = getPriceAtDate(data, sipInvestDate);
            if (sipPrice > 0) {
              sipUnits += monthlyAmount / sipPrice;
            }
          });
          sipEndValue += sipUnits * endPrice;
        });

        const advantage = lumpsumEndValue - sipEndValue;
        const winner: 'Lumpsum' | 'SIP' | 'Tie' =
          advantage > 0 ? 'Lumpsum' : advantage < 0 ? 'SIP' : 'Tie';

        combinations.push({
          endMonth: candidateEndMonth,
          durationMonths,
          startMonth: windowStartMonth,
          lumpsumEndValue,
          sipEndValue,
          winner,
          advantage: Math.abs(advantage),
        });
      });
    });

    const summaryByDuration = durationBuckets.map((durationMonths) => {
      const rows = combinations.filter((c) => c.durationMonths === durationMonths);
      const lumpsumWins = rows.filter((r) => r.winner === 'Lumpsum').length;
      const sipWins = rows.filter((r) => r.winner === 'SIP').length;
      const ties = rows.filter((r) => r.winner === 'Tie').length;
      const avgLumpsumEndValue =
        rows.length > 0 ? rows.reduce((s, r) => s + r.lumpsumEndValue, 0) / rows.length : 0;
      const avgSipEndValue =
        rows.length > 0 ? rows.reduce((s, r) => s + r.sipEndValue, 0) / rows.length : 0;
      return {
        durationMonths,
        windows: rows.length,
        lumpsumWins,
        sipWins,
        ties,
        avgLumpsumEndValue,
        avgSipEndValue,
      };
    });

    return {
      durationBuckets,
      endMonths: months,
      combinations,
      summaryByDuration,
    };
  })();

  /* ─────────────── Price chart (same as Lumpsum tab) ─────────────── */

  const priceChartSeries = uniqueTickers
    .filter((t) => priceDataByTicker[t]?.length > 0)
    .map((t) => ({ ticker: t, data: priceDataByTicker[t]! }));

  const hasAnyChartData = hasResults && priceChartSeries.length > 0;
  const weightedAverageSeries = (() => {
    const validEntries = entries
      .filter((e) => e.ticker.trim() && parseFloat(e.amount) > 0)
      .map((e) => ({ ticker: e.ticker.trim().toUpperCase(), amount: parseFloat(e.amount) || 0 }));
    if (validEntries.length === 0) return [] as Array<{ date: Date; nav: number }>;

    const totalAmount = validEntries.reduce((sum, e) => sum + e.amount, 0);
    if (totalAmount <= 0) return [] as Array<{ date: Date; nav: number }>;

    const weightByTicker = new Map(validEntries.map((e) => [e.ticker, e.amount / totalAmount]));
    const dateKeySet = new Set<string>();
    validEntries.forEach(({ ticker }) => {
      const data = priceDataByTicker[ticker];
      if (!data || data.length === 0) return;
      data.forEach((point) => dateKeySet.add(point.date.toISOString().slice(0, 10)));
    });

    const dates = Array.from(dateKeySet)
      .map((d) => new Date(`${d}T12:00:00Z`))
      .sort((a, b) => a.getTime() - b.getTime());

    return dates.map((date) => {
      let weightedPrice = 0;
      validEntries.forEach(({ ticker }) => {
        const data = priceDataByTicker[ticker];
        if (!data || data.length === 0) return;
        const price = getPriceAtDate(data, date);
        const weight = weightByTicker.get(ticker) ?? 0;
        weightedPrice += price * weight;
      });
      return { date, nav: weightedPrice };
    });
  })();

  const weightedWinnerChartOptions: Highcharts.Options | null = (() => {
    if (!hasResults || weightedAverageSeries.length === 0) return null;

    const markerDuration = durationBuckets[0] ?? 1;
    const baseBucketCombos = winnerGridResult.combinations
      .filter((combo) => combo.durationMonths === markerDuration)
      .sort((a, b) => a.endMonth.localeCompare(b.endMonth));

    const comboByEndMonth = new Map(baseBucketCombos.map((combo) => [combo.endMonth, combo] as const));
    const lumpsumPoints: Array<[number, number]> = [];
    const sipPoints: Array<[number, number]> = [];
    const tiePoints: Array<[number, number]> = [];

    weightedAverageSeries.forEach((point) => {
      const month = formatDateAsMonth(point.date);
      const combo = comboByEndMonth.get(month);
      if (!combo) return;
      const xy: [number, number] = [point.date.getTime(), point.nav];
      if (combo.winner === 'Lumpsum') lumpsumPoints.push(xy);
      else if (combo.winner === 'SIP') sipPoints.push(xy);
      else tiePoints.push(xy);
    });

    return {
      chart: {
        backgroundColor: '#ffffff',
        borderRadius: 8,
        spacing: [20, 20, 20, 20],
        height: 460,
      },
      title: { text: 'Portfolio weighted average price with winner months' },
      credits: { enabled: false },
      xAxis: {
        type: 'datetime',
        title: { text: 'Date' },
      },
      yAxis: {
        title: { text: 'Weighted average price ($)' },
      },
      legend: { enabled: true },
      tooltip: {
        shared: true,
      },
      plotOptions: {
        series: {
          animation: false,
        },
      },
      series: [
        {
          type: 'line',
          name: 'Weighted avg price',
          data: weightedAverageSeries.map((p) => [p.date.getTime(), p.nav]),
          color: '#0f172a',
          lineWidth: 2,
          marker: { enabled: false },
        },
        {
          type: 'scatter',
          name: `Lumpsum better (${markerDuration}m window)`,
          data: lumpsumPoints,
          color: '#6366f1',
          marker: { radius: 4, symbol: 'circle' },
        },
        {
          type: 'scatter',
          name: `SIP better (${markerDuration}m window)`,
          data: sipPoints,
          color: '#ec4899',
          marker: { radius: 4, symbol: 'circle' },
        },
        {
          type: 'scatter',
          name: `Tie (${markerDuration}m window)`,
          data: tiePoints,
          color: '#64748b',
          marker: { radius: 4, symbol: 'circle' },
        },
      ],
    };
  })();

  const winnerHeatmapOptions: Highcharts.Options | null = (() => {
    if (!hasResults || winnerGridResult.combinations.length === 0) return null;

    const endMonthCategories = winnerGridResult.endMonths;
    const startMonthCategories = winnerGridResult.endMonths;
    const pointByKey = new Map(
      winnerGridResult.combinations.map((combo) => [`${combo.startMonth}|${combo.endMonth}`, combo] as const)
    );

    const data: Array<[number, number, number]> = [];
    startMonthCategories.forEach((sm, rowIndex) => {
      endMonthCategories.forEach((em, colIndex) => {
        const combo = pointByKey.get(`${sm}|${em}`);
        if (!combo) return;
        const encodedWinner = combo.winner === 'Lumpsum' ? 1 : combo.winner === 'SIP' ? -1 : 0;
        data.push([colIndex, rowIndex, encodedWinner]);
      });
    });

    return {
      chart: {
        type: 'heatmap',
        height: Math.max(280, endMonthCategories.length * 28 + 110),
        backgroundColor: '#ffffff',
      },
      title: { text: undefined },
      credits: { enabled: false },
      xAxis: {
        categories: endMonthCategories.map(formatMonthLabel),
        title: { text: 'End month' },
      },
      yAxis: {
        categories: startMonthCategories.map(formatMonthLabel),
        title: { text: 'Start month' },
        reversed: true,
      },
      legend: {
        align: 'right',
        layout: 'vertical',
        verticalAlign: 'middle',
      },
      colorAxis: {
        min: -1,
        max: 1,
        stops: [
          [0, '#ec4899'],
          [0.5, '#e2e8f0'],
          [1, '#6366f1'],
        ],
      },
      tooltip: {
        formatter: function (this: any) {
          const endMonth = endMonthCategories[this.point.x];
          const startMonth = startMonthCategories[this.point.y];
          const combo = pointByKey.get(`${startMonth}|${endMonth}`);
          if (!combo) return '';
          return `
            <strong>${formatMonthLabel(combo.startMonth)} to ${formatMonthLabel(combo.endMonth)}</strong><br/>
            Duration: ${combo.durationMonths} months<br/>
            Winner: <strong>${combo.winner}</strong><br/>
            Lumpsum: $${combo.lumpsumEndValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br/>
            SIP: $${combo.sipEndValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br/>
            Advantage: $${combo.advantage.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          `;
        },
      },
      series: [
        {
          type: 'heatmap',
          data,
          dataLabels: {
            enabled: true,
            style: { textOutline: 'none', fontSize: '10px' },
            formatter: function (this: any) {
              if (this.point.value > 0) return 'L';
              if (this.point.value < 0) return 'S';
              return 'T';
            },
          },
        },
      ],
    };
  })();

  const handleDownloadJson = () => {
    const validEntries = entries
      .filter((e) => e.ticker.trim() && parseFloat(e.amount) > 0)
      .map((e) => ({
        ticker: e.ticker.trim().toUpperCase(),
        amount: parseFloat(e.amount) || 0,
      }));

    const rawPricesByTicker = Object.fromEntries(
      Object.entries(priceDataByTicker).map(([ticker, data]) => [
        ticker,
        data.map((point) => ({
          date: point.date.toISOString(),
          nav: point.nav,
        })),
      ])
    );

    const payload = {
      metadata: {
        exportedAt: new Date().toISOString(),
        sourcePage: 'compare',
      },
      parameters: {
        holdings: validEntries,
        startMonth,
        endMonth,
        durationFrom: Math.min(durationFrom, durationTo),
        durationTo: Math.max(durationFrom, durationTo),
        durationBuckets,
        monthsInRange: months,
      },
      rawPricesByTicker,
      results: {
        summaryByDuration: winnerGridResult.summaryByDuration,
        winnerGrid: winnerGridResult.combinations,
        weightedAveragePriceSeries: weightedAverageSeries.map((point) => ({
          date: point.date.toISOString(),
          weightedPrice: point.nav,
        })),
      },
    };

    const filename = `compare-export-${startMonth}-to-${endMonth}.json`;
    downloadJsonFile(payload, filename);
  };

  /* ─────────────── Render ─────────────── */

  return (
    <Block position="relative">
      <LoadingOverlay active={loading} />

      <PageIntro title="Compare Lumpsum vs SIP">
        Enter total dollars per ticker. For each duration in your range (e.g. 1–3 months), every rolling window compares X-month lumpsum vs X-month SIP — not a full start-to-end SIP. Use ~12 for a synthetic 12% path.
      </PageIntro>

      <PageCard>
        <HoldingsSection
          entries={entries}
          onUpdate={(id, field, value) => handleUpdateEntry(id, field, value)}
          onAddRow={handleAddRow}
          onRemoveRow={handleRemoveRow}
        />
        <Block display="flex" alignItems="center" gridGap="scale400" marginTop="scale500" $style={{ flexWrap: 'wrap' }}>
          <Block display="flex" alignItems="center" gridGap="scale200" $style={{ flexWrap: 'wrap' }}>
            <LabelMedium marginBottom="0" marginTop="0">Start month</LabelMedium>
            <input
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              style={dateInputStyle}
            />
          </Block>
          <Block display="flex" alignItems="center" gridGap="scale200" $style={{ flexWrap: 'wrap' }}>
            <LabelMedium marginBottom="0" marginTop="0">End month</LabelMedium>
            <input
              type="month"
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              style={dateInputStyle}
            />
          </Block>
          <Block display="flex" alignItems="center" gridGap="scale200" $style={{ flexWrap: 'wrap' }}>
            <LabelMedium marginBottom="0" marginTop="0">Duration from (months)</LabelMedium>
            <Input
              value={Number.isFinite(durationFrom) ? String(durationFrom) : ''}
              type="number"
              min={1}
              max={12}
              onChange={(e) => {
                const raw = (e.target as HTMLInputElement).value;
                const next = Number(raw);
                if (raw === '') setDurationFrom(Number.NaN);
                else if (Number.isFinite(next)) setDurationFrom(next);
              }}
              placeholder="1"
              size="compact"
              overrides={{ Root: { style: { width: '90px' } } }}
            />
          </Block>
          <Block display="flex" alignItems="center" gridGap="scale200" $style={{ flexWrap: 'wrap' }}>
            <LabelMedium marginBottom="0" marginTop="0">Duration to (months)</LabelMedium>
            <Input
              value={Number.isFinite(durationTo) ? String(durationTo) : ''}
              type="number"
              min={1}
              max={12}
              onChange={(e) => {
                const raw = (e.target as HTMLInputElement).value;
                const next = Number(raw);
                if (raw === '') setDurationTo(Number.NaN);
                else if (Number.isFinite(next)) setDurationTo(next);
              }}
              placeholder="3"
              size="compact"
              overrides={{ Root: { style: { width: '90px' } } }}
            />
          </Block>
          <Button kind="primary" onClick={handleCompare} disabled={!hasValidEntries || isRangeInvalid || isDurationInvalid}>
            Compare
          </Button>
          <Button kind="secondary" onClick={handleDownloadJson} disabled={!hasResults}>
            Download JSON
          </Button>
          {isRangeInvalid && (
            <LabelMedium marginBottom="0" marginTop="0" overrides={{ Block: { style: ({ $theme }) => ({ color: $theme.colors.negative }) } }}>
              Start month must be before end month
            </LabelMedium>
          )}
          {isDurationInvalid && (
            <LabelMedium marginBottom="0" marginTop="0" overrides={{ Block: { style: ({ $theme }) => ({ color: $theme.colors.negative }) } }}>
              Duration range must be between 1 and 12 months
            </LabelMedium>
          )}
        </Block>
      </PageCard>

      {hasAnyChartData && (
        <Block maxWidth="960px" margin="0 auto" width="100%">
          {winnerGridResult.summaryByDuration.length > 0 && (
            <Block
              key="compare-summary"
              padding="scale600"
              marginBottom="scale500"
              backgroundColor="backgroundPrimary"
              overrides={{
                Block: {
                  style: ({ $theme }) => ({
                    borderRadius: $theme.borders.radius300,
                    fontSize: '14px',
                    border: `1px solid ${$theme.colors.borderOpaque}`,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }),
                },
              }}
            >
              <LabelMedium marginBottom="scale200" $style={{ fontWeight: 700, fontSize: '16px' }}>
                Results by duration
              </LabelMedium>
              <ParagraphSmall marginTop="0" marginBottom="scale300" color="contentSecondary">
                Each row is rolling X-month lumpsum vs X-month SIP over your date range (not a full-period SIP).
              </ParagraphSmall>
              <Table
                columns={[
                  'Duration (months)',
                  'Windows',
                  'Lumpsum wins',
                  'SIP wins',
                  'Ties',
                  'Avg lumpsum end ($)',
                  'Avg SIP end ($)',
                ]}
                data={winnerGridResult.summaryByDuration.map((row) => [
                  row.durationMonths,
                  row.windows,
                  row.lumpsumWins,
                  row.sipWins,
                  row.ties,
                  row.avgLumpsumEndValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  row.avgSipEndValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                ])}
                divider="horizontal"
                size="compact"
              />
            </Block>
          )}

          {winnerHeatmapOptions && (
            <Block
              key="winner-grid"
              marginBottom="scale500"
              padding="scale600"
              backgroundColor="backgroundPrimary"
              overrides={{
                Block: {
                  style: ({ $theme }) => ({
                    borderRadius: $theme.borders.radius300,
                    border: `1px solid ${$theme.colors.borderOpaque}`,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }),
                },
              }}
            >
              <LabelMedium marginBottom="scale200" $style={{ fontWeight: 700, fontSize: '16px' }}>
                Lumpsum vs SIP winner grid
              </LabelMedium>
              <ParagraphSmall marginTop="0" marginBottom="scale300" color="contentSecondary">
                Only windows whose length is in your duration range ({durationBuckets.join(', ')} months). L = Lumpsum, S = SIP, T = Tie.
              </ParagraphSmall>
              <HighchartsReact highcharts={Highcharts} options={winnerHeatmapOptions} />
              <Table
                columns={['End month', 'Duration (months)', 'Window start', 'Lumpsum end value ($)', 'SIP end value ($)', 'Winner', 'Advantage ($)']}
                data={winnerGridResult.combinations.map((combo) => [
                  combo.endMonth,
                  combo.durationMonths,
                  combo.startMonth,
                  combo.lumpsumEndValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  combo.sipEndValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  combo.winner === 'Lumpsum'
                    ? <span style={{ color: '#6366f1', fontWeight: 600 }}>Lumpsum</span>
                    : combo.winner === 'SIP'
                      ? <span style={{ color: '#ec4899', fontWeight: 600 }}>SIP</span>
                      : <span style={{ fontWeight: 600 }}>Tie</span>,
                  combo.advantage.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                ])}
                divider="horizontal"
                size="compact"
              />
            </Block>
          )}

          {weightedWinnerChartOptions && (
            <Block
              key="weighted-price-winner-chart"
              marginBottom="scale500"
              padding="scale600"
              backgroundColor="backgroundPrimary"
              overrides={{
                Block: {
                  style: ({ $theme }) => ({
                    borderRadius: $theme.borders.radius300,
                    border: `1px solid ${$theme.colors.borderOpaque}`,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }),
                },
              }}
            >
              <ParagraphSmall marginTop="0" marginBottom="scale300" color="contentSecondary">
                Weighted average portfolio price. Dots mark end months for the shortest duration in your range ({durationBuckets[0] ?? '—'}m): Lumpsum vs SIP win.
              </ParagraphSmall>
              <HighchartsReact highcharts={Highcharts} options={weightedWinnerChartOptions} />
            </Block>
          )}

          {priceChartSeries.length > 0 && (
            <StockPriceChart key="compare-price" series={priceChartSeries} colors={COLORS} />
          )}
        </Block>
      )}
    </Block>
  );
}
