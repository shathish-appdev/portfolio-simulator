import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { Input } from 'baseui/input';
import { Table } from 'baseui/table-semantic';
import { LabelMedium, ParagraphMedium } from 'baseui/typography';
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import xirr from 'xirr';
import { StockPortfolioValueChart } from '../components/charts/StockPortfolioValueChart';
import { StockPortfolioValueNormalizedChart } from '../components/charts/StockPortfolioValueNormalizedChart';
import { StockPriceChart } from '../components/charts/StockPriceChart';
import { StockPriceNormalizedChart } from '../components/charts/StockPriceNormalizedChart';
import { LoadingOverlay } from '../components/common/LoadingOverlay';
import { COLORS } from '../constants';
import { yahooFinanceService } from '../services/yahooFinanceService';
import { fillMissingNavDates } from '../utils/data/fillMissingNavDates';

function calculateXirr(
  investDate: Date,
  investAmount: number,
  endDate: Date,
  endValue: number
): number | null {
  if (investAmount <= 0) return null;
  if (!investDate || !endDate) return null;

  // When there are only two cash flows (single investment and single redemption)
  // we can compute the annualized return exactly instead of using a numeric
  // solver. This is more robust for extreme returns where the solver may fail
  // to converge.
  try {
    const msPerDay = 86400000;
    const days = (endDate.getTime() - investDate.getTime()) / msPerDay;
    if (days <= 0) return null;
  const years = days / 365;

    // Handle zero endValue (100% loss)
    if (endValue === 0) return -1;

    const ratio = endValue / investAmount;
    // ratio should be >= 0. If ratio is negative or NaN, fall back to numeric solver.
    if (!isFinite(ratio) || ratio < 0) {
      try {
        return xirr([
          { amount: -investAmount, when: investDate },
          { amount: endValue, when: endDate },
        ]);
      } catch {
        return null;
      }
    }

    const annual = Math.pow(ratio, 1 / years) - 1;
    if (!isFinite(annual) || Number.isNaN(annual)) {
      // fallback to library if direct formula yields invalid result
      try {
        return xirr([
          { amount: -investAmount, when: investDate },
          { amount: endValue, when: endDate },
        ]);
      } catch {
        return null;
      }
    }
    return annual;
  } catch {
    // final fallback to numeric solver
    try {
      return xirr([
        { amount: -investAmount, when: investDate },
        { amount: endValue, when: endDate },
      ]);
    } catch {
      return null;
    }
  }
}

// Wrapper that logs inputs/results to help debug failing XIRR cases.
function safeCalculateXirr(
  investDate: Date | null,
  investAmount: number,
  endDate: Date | null,
  endValue: number,
  ctx?: { portfolioName?: string; ticker?: string }
): number | null {
  try {
    if (!investDate || !endDate) {
      console.debug('safeCalculateXirr: missing dates', { investDate, endDate, investAmount, endValue, ...ctx });
      return null;
    }
    if (investAmount <= 0) {
      console.debug('safeCalculateXirr: non-positive investAmount', { investAmount, ...ctx });
      return null;
    }
    const result = calculateXirr(investDate, investAmount, endDate, endValue);
    const msPerDay = 86400000;
    const days = (endDate.getTime() - investDate.getTime()) / msPerDay;
    const years365 = days / 365;
    const years36525 = days / 365.25;
    const ratio = investAmount !== 0 ? endValue / investAmount : NaN;
    const percent = result == null || !isFinite(result) ? null : result * 100;
    if (result == null || !isFinite(result)) {
      console.debug('safeCalculateXirr: xirr returned null/invalid, attempting fallback', { result, percent, ratio, days, years365, years36525, investDate, endDate, investAmount, endValue, ...ctx });
      // fallback: compute simple annualized return between two dates
      try {
        const msPerDay = 86400000;
        const days = (endDate.getTime() - investDate.getTime()) / msPerDay;
        if (days > 0 && endValue > 0) {
          const years = days / 365;
          if (investAmount !== 0) {
            const ratio2 = endValue / investAmount;
            if (ratio2 > 0) {
              const fallback = Math.pow(ratio2, 1 / years) - 1;
              console.debug('safeCalculateXirr: fallback annualized rate used', { fallback, fallbackPercent: fallback * 100, years, days, ratio: ratio2, ...ctx });
              return fallback;
            }
          }
        }
      } catch (err) {
        console.error('safeCalculateXirr: fallback compute error', err, { investDate, endDate, investAmount, endValue, ...ctx });
      }
      console.debug('safeCalculateXirr: returning null after fallback attempt', { investDate, endDate, investAmount, endValue, ...ctx });
      return null;
    } else {
      console.debug('safeCalculateXirr: computed', { result, investDate, endDate, investAmount, endValue, ...ctx });
      return result;
    }
  } catch (err) {
    console.error('safeCalculateXirr: exception', err, { investDate, endDate, investAmount, endValue, ...ctx });
    return null;
  }
}

function getPriceAtDate(data: Array<{ date: Date; nav: number }>, targetDate: Date): number {
  const t = targetDate.getTime();
  let last = data[0];
  for (const p of data) {
    if (p.date.getTime() <= t) last = p;
    else break;
  }
  return last.nav;
}

function computePortfolioValueOverTime(
  portfolioSummary: Array<{ ticker: string; units: number }>,
  priceDataByTicker: Record<string, Array<{ date: Date; nav: number }>>
): Array<{ date: Date; value: number }> {
  const allDates = new Set<number>();
  portfolioSummary.forEach((s) => {
    const data = priceDataByTicker[s.ticker];
    data?.forEach((d) => allDates.add(d.date.getTime()));
  });
  const sortedDates = Array.from(allDates).sort((a, b) => a - b);
  return sortedDates.map((ts) => {
    const date = new Date(ts);
    const value = portfolioSummary.reduce((sum, s) => {
      const data = priceDataByTicker[s.ticker];
      if (!data) return sum;
      const price = getPriceAtDate(data, date);
      return sum + s.units * price;
    }, 0);
    return { date, value };
  });
}

function defaultStartDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function defaultEndDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Parse synthetic ticker: ~12 = 12% XIRR, ~12.5 = 12.5%, ~TARGET_RATE = 12%.
 * Returns { rate: 0.12 } or null if not a synthetic ticker.
 */
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

/**
 * Generate synthetic price data that grows at fixed XIRR.
 * Start price = 1, so units = amount. Each day: price = (1+r)^(days/365.25).
 */
function generateSyntheticPriceData(
  startDateStr: string,
  endDateStr: string,
  xirrRate: number
): Array<{ date: Date; nav: number }> {
  const start = new Date(startDateStr + 'T00:00:00Z');
  const end = new Date(endDateStr + 'T23:59:59Z');
  const result: Array<{ date: Date; nav: number }> = [];
  const msPerDay = 86400000;
  const startMs = start.getTime();

  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setTime(d.getTime() + msPerDay)) {
    const daysSinceStart = (d.getTime() - startMs) / msPerDay;
    const years = daysSinceStart / 365.25;
    const nav = Math.pow(1 + xirrRate, years);
    result.push({
      date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
      nav,
    });
  }

  return result;
}

interface PortfolioEntry {
  id: string;
  ticker: string;
  amount: string;
}

interface PortfolioDef {
  id: string;
  name: string;
  entries: PortfolioEntry[];
}

const INITIAL_PORTFOLIOS: PortfolioDef[] = [
  { id: 'A', name: 'Portfolio A', entries: [{ id: '1', ticker: '', amount: '' }] },
  { id: 'B', name: 'Portfolio B', entries: [{ id: '2', ticker: '', amount: '' }] },
];

/** Parse portfolios from URL: pa=ticker:amt,ticker:amt&pb=...&start=YYYY-MM-DD&end=YYYY-MM-DD */
function parseStockPriceParams(searchParams: URLSearchParams): {
  portfolios: PortfolioDef[];
  startDate: string;
  endDate: string;
} | null {
  const pa = searchParams.get('pa');
  const pb = searchParams.get('pb');
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  if (!pa && !pb && !start && !end) return null;

  const parseEntries = (s: string | null): PortfolioEntry[] => {
    if (!s?.trim()) return [{ id: crypto.randomUUID?.() ?? String(Date.now()), ticker: '', amount: '' }];
    const parsed = s.split(',').map((part) => {
      const colon = part.indexOf(':');
      const ticker = colon >= 0 ? part.slice(0, colon).trim() : part.trim();
      const amount = colon >= 0 ? part.slice(colon + 1).trim() : '';
      return {
        id: crypto.randomUUID?.() ?? String(Date.now() + Math.random()),
        ticker: ticker.toUpperCase(),
        amount: amount.replace(/[^0-9.]/g, ''),
      };
    }).filter((e) => e.ticker || e.amount);
    return parsed.length ? parsed : [{ id: crypto.randomUUID?.() ?? String(Date.now()), ticker: '', amount: '' }];
  };

  const entriesA = parseEntries(pa);
  const entriesB = parseEntries(pb);
  if (entriesA.length === 0 && entriesB.length === 0 && !start && !end) return null;

  return {
    portfolios: [
      { id: 'A', name: 'Portfolio A', entries: entriesA.length ? entriesA : [{ id: crypto.randomUUID?.() ?? '1', ticker: '', amount: '' }] },
      { id: 'B', name: 'Portfolio B', entries: entriesB.length ? entriesB : [{ id: crypto.randomUUID?.() ?? '2', ticker: '', amount: '' }] },
    ],
    startDate: start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : defaultStartDate(),
    endDate: end && /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : defaultEndDate(),
  };
}

/** Serialize state to URL params */
function serializeStockPriceParams(
  portfolios: PortfolioDef[],
  startDate: string,
  endDate: string
): URLSearchParams {
  const params = new URLSearchParams();
  const entriesToStr = (entries: PortfolioEntry[]) =>
    entries.filter((e) => e.ticker.trim() || parseFloat(e.amount) > 0).map((e) => `${e.ticker}:${e.amount}`).join(',');
  const pa = entriesToStr(portfolios[0]?.entries ?? []);
  const pb = entriesToStr(portfolios[1]?.entries ?? []);
  if (pa) params.set('pa', pa);
  if (pb) params.set('pb', pb);
  params.set('start', startDate);
  params.set('end', endDate);
  return params;
}

const dateInputStyle = {
  padding: '8px 12px',
  borderRadius: '4px',
  border: '1px solid #e5e7eb',
  fontSize: '14px',
  fontFamily: 'inherit' as const,
};

function PortfolioSection({
  portfolio,
  onUpdate,
  onAddRow,
  onRemoveRow,
  borderColor,
}: {
  portfolio: PortfolioDef;
  onUpdate: (id: string, field: 'ticker' | 'amount', value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  borderColor: string;
}) {
  return (
    <Block
      padding="scale500"
      marginBottom="scale400"
      overrides={{
        Block: {
          style: {
            borderLeft: `4px solid ${borderColor}`,
            borderRadius: '8px',
            backgroundColor: '#fafafa',
          },
        },
      }}
    >
      <LabelMedium marginBottom="scale300" $style={{ fontWeight: 600 }}>
        {portfolio.name}
      </LabelMedium>
      <Block display="flex" flexDirection="column" gridGap="scale300">
        {portfolio.entries.map((entry) => (
          <Block key={entry.id} display="flex" alignItems="center" gridGap="scale300" flexWrap="wrap">
            <Input
              value={entry.ticker}
              onChange={(e) => onUpdate(entry.id, 'ticker', (e.target as HTMLInputElement).value)}
              placeholder="Ticker (e.g. AAPL, ~12)"
              size="compact"
              overrides={{ Root: { style: { width: '140px', minWidth: '120px' } } }}
            />
            <LabelMedium marginBottom="0" marginTop="0">$</LabelMedium>
            <Input
              value={entry.amount}
              onChange={(e) => onUpdate(entry.id, 'amount', (e.target as HTMLInputElement).value.replace(/[^0-9.]/g, ''))}
              placeholder="Amount"
              size="compact"
              overrides={{ Root: { style: { width: '100px', minWidth: '80px' } } }}
            />
            <Button kind="tertiary" size="mini" onClick={() => onRemoveRow(entry.id)} disabled={portfolio.entries.length <= 1}>
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

export const StockPriceTab: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialFromUrl = useMemo(() => parseStockPriceParams(searchParams), [searchParams.toString()]);
  const [portfolios, setPortfolios] = useState<PortfolioDef[]>(() => {
    if (initialFromUrl) return initialFromUrl.portfolios;
    return INITIAL_PORTFOLIOS.map((p) => ({
      ...p,
      entries: p.entries.map((e) => ({ ...e, id: crypto.randomUUID?.() ?? String(Date.now() + Math.random()) })),
    }));
  });
  const [priceDataByTicker, setPriceDataByTicker] = useState<
    Record<string, Array<{ date: Date; nav: number }>>
  >({});
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState<string>(
    () => initialFromUrl?.startDate ?? defaultStartDate()
  );
  const [endDate, setEndDate] = useState<string>(
    () => initialFromUrl?.endDate ?? defaultEndDate()
  );

  useEffect(() => {
    if (initialFromUrl) {
      setPortfolios(initialFromUrl.portfolios);
      setStartDate(initialFromUrl.startDate);
      setEndDate(initialFromUrl.endDate);
    }
  }, [searchParams.toString()]);
  const [chartKey, setChartKey] = useState(0);

  const isDateRangeInvalid = new Date(startDate) > new Date(endDate);

  const allValidEntries = portfolios.flatMap((p) =>
    p.entries
      .filter((e) => e.ticker.trim() && parseFloat(e.amount) > 0)
      .map((e) => ({ ...e, portfolioId: p.id, portfolioName: p.name }))
  );
  const hasValidEntries = allValidEntries.length > 0;
  const uniqueTickers = [...new Set(allValidEntries.map((e) => e.ticker.trim().toUpperCase()))];

  const handleAddRow = (portfolioId: string) => {
    setPortfolios((prev) =>
      prev.map((p) =>
        p.id === portfolioId
          ? {
              ...p,
              entries: [
                ...p.entries,
                { id: crypto.randomUUID?.() ?? String(Date.now()), ticker: '', amount: '' },
              ],
            }
          : p
      )
    );
  };

  const handleRemoveRow = (portfolioId: string, entryId: string) => {
    setPortfolios((prev) =>
      prev.map((p) =>
        p.id === portfolioId && p.entries.length > 1
          ? { ...p, entries: p.entries.filter((e) => e.id !== entryId) }
          : p
      )
    );
  };

  const handleUpdateEntry = (portfolioId: string, entryId: string, field: 'ticker' | 'amount', value: string) => {
    setPortfolios((prev) =>
      prev.map((p) =>
        p.id === portfolioId
          ? {
              ...p,
              entries: p.entries.map((e) =>
                e.id === entryId
                  ? {
                      ...e,
                      [field]: field === 'ticker' ? value.toUpperCase() : value.replace(/[^0-9.]/g, ''),
                    }
                  : e
              ),
            }
          : p
      )
    );
  };

  const handlePlot = async () => {
    if (!hasValidEntries || isDateRangeInvalid) return;

    setLoading(true);
    setPriceDataByTicker({});
    try {
      const realTickers = uniqueTickers.filter((t) => !parseSyntheticTicker(t));
      const syntheticTickers = uniqueTickers
        .map((t) => ({ ticker: t, parsed: parseSyntheticTicker(t) }))
        .filter((x): x is { ticker: string; parsed: { rate: number } } => x.parsed != null);

      const byTicker: Record<string, Array<{ date: Date; nav: number }>> = {};

      if (realTickers.length > 0) {
        const results = await Promise.allSettled(
          realTickers.map((t) =>
            yahooFinanceService.fetchStockData(t, { startDate, endDate })
          )
        );
        results.forEach((result, i) => {
          const ticker = realTickers[i];
          if (result.status === 'fulfilled') {
            byTicker[ticker] = fillMissingNavDates(result.value);
          }
        });
      }

      syntheticTickers.forEach(({ ticker, parsed }) => {
        const data = generateSyntheticPriceData(startDate, endDate, parsed.rate);
        byTicker[ticker] = data;
      });

      setPriceDataByTicker(byTicker);
      setChartKey((k) => k + 1);
      setSearchParams(serializeStockPriceParams(portfolios, startDate, endDate), { replace: true });
    } catch (error) {
      console.error('Error fetching stock prices:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartSeries = uniqueTickers
    .filter((t) => priceDataByTicker[t]?.length > 0)
    .map((t) => ({ ticker: t, data: priceDataByTicker[t]! }));

  const portfolioResults = portfolios.map((p) => {
    const validEntries = p.entries.filter((e) => e.ticker.trim() && parseFloat(e.amount) > 0);
    const summary = validEntries
      .map((e) => {
        const ticker = e.ticker.trim().toUpperCase();
        const data = priceDataByTicker[ticker];
        const amount = parseFloat(e.amount) || 0;
        const startPrice = data?.[0]?.nav ?? 0;
        const endPrice = data?.length ? data[data.length - 1].nav : 0;
        const units = startPrice > 0 && amount > 0 ? amount / startPrice : null;
        const endValue = units != null && endPrice > 0 ? units * endPrice : null;
        return { ticker, amount, startPrice, units, endValue };
      })
      .filter((s) => s.units != null);

    const totalInvestment = summary.reduce((sum, s) => sum + s.amount, 0);
    const totalEndValue = summary.reduce((sum, s) => sum + (s.endValue ?? 0), 0);
    const valueData =
      summary.length > 0
        ? computePortfolioValueOverTime(
            summary.map((s) => ({ ticker: s.ticker, units: s.units! })),
            priceDataByTicker
          )
        : [];

    const investDate = valueData.length > 0 ? valueData[0].date : null;
    const valueDate = valueData.length > 0 ? valueData[valueData.length - 1].date : null;

    const summaryWithXirr = summary.map((s) => {
      if (s.units == null) {
        console.debug('summaryWithXirr: skipping entry with null units', { ticker: s.ticker, amount: s.amount, startPrice: s.startPrice });
      }
      const xirrVal =
        investDate && valueDate && s.endValue != null && s.amount > 0
          ? safeCalculateXirr(investDate, s.amount, valueDate, s.endValue, { portfolioName: p.name, ticker: s.ticker })
          : null;
      return { ...s, xirr: xirrVal };
    });

    const totalXirr =
      investDate && valueDate && totalInvestment > 0
        ? safeCalculateXirr(investDate, totalInvestment, valueDate, totalEndValue, { portfolioName: p.name })
        : null;

    return {
      portfolio: p,
      summary: summaryWithXirr,
      totalInvestment,
      totalEndValue,
      totalXirr,
      valueData,
    };
  });

  const portfolioValueSeries = portfolioResults
    .filter((r) => r.valueData.length > 0)
    .map((r) => ({ name: r.portfolio.name, data: r.valueData }));

  const hasAnyChartData = chartSeries.length > 0 || portfolioValueSeries.length > 0;

  return (
    <Block position="relative">
      <LoadingOverlay active={loading} />

      <Block maxWidth="900px" margin="0 auto" marginBottom="scale400" paddingTop="0" display="flex" justifyContent="center">
        <ParagraphMedium color="contentTertiary" marginTop="0" marginBottom="0">
          Build and compare two portfolios. Add stocks to Portfolio A and/or B. Use ~12 for a 12% XIRR target, ~TARGET_RATE for 12%, or ~TARGET_RATE:10 for 10%.
        </ParagraphMedium>
      </Block>

      <Block maxWidth="900px" margin="0 auto">
        <Block
          position="relative"
          padding="scale700"
          marginBottom="scale600"
          backgroundColor="backgroundPrimary"
          overrides={{
            Block: {
              style: ({ $theme }) => ({
                borderLeft: '4px solid #007bff',
                borderRadius: $theme.borders.radius200,
              }),
            },
          }}
        >
          <Block display="flex" flexDirection={['column', 'column', 'row']} gridGap="scale600">
            <Block flex="1">
              <PortfolioSection
                portfolio={portfolios[0]}
                onUpdate={(id, field, value) => handleUpdateEntry(portfolios[0].id, id, field, value)}
                onAddRow={() => handleAddRow(portfolios[0].id)}
                onRemoveRow={(id) => handleRemoveRow(portfolios[0].id, id)}
                borderColor="#6366f1"
              />
            </Block>
            <Block flex="1">
              <PortfolioSection
                portfolio={portfolios[1]}
                onUpdate={(id, field, value) => handleUpdateEntry(portfolios[1].id, id, field, value)}
                onAddRow={() => handleAddRow(portfolios[1].id)}
                onRemoveRow={(id) => handleRemoveRow(portfolios[1].id, id)}
                borderColor="#ec4899"
              />
            </Block>
          </Block>
          <Block display="flex" alignItems="center" gridGap="scale300" flexWrap="wrap" marginTop="scale400">
            <LabelMedium marginBottom="0" marginTop="0">Start Date</LabelMedium>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={dateInputStyle} />
            <LabelMedium marginBottom="0" marginTop="0">End Date</LabelMedium>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={dateInputStyle} />
            <Button kind="primary" onClick={handlePlot} disabled={!hasValidEntries || isDateRangeInvalid}>
              Plot
            </Button>
            {isDateRangeInvalid && (
              <LabelMedium marginBottom="0" marginTop="0" overrides={{ Block: { style: ({ $theme }) => ({ color: $theme.colors.negative }) } }}>
                Start date must be before end date
              </LabelMedium>
            )}
          </Block>
        </Block>
      </Block>

      {hasAnyChartData && (
        <Block maxWidth="90%" margin="0 auto">
          {portfolioResults.map((result) =>
            result.summary.length > 0 ? (
              <Block
                key={result.portfolio.id}
                padding="scale500"
                marginBottom="scale400"
                backgroundColor="backgroundSecondary"
                overrides={{
                  Block: {
                    style: ({ $theme }) => ({
                      borderRadius: $theme.borders.radius200,
                      fontSize: '14px',
                    }),
                  },
                }}
              >
                <LabelMedium marginBottom="scale300" $style={{ fontWeight: 600 }}>
                  {result.portfolio.name}
                </LabelMedium>
                <Table
                  columns={['Ticker', 'Investment ($)', 'Units', 'End Value ($)', 'Return (%)', 'XIRR (%)']}
                  data={result.summary.map((s) => {
                    const returnPct = s.endValue != null && s.amount > 0 ? ((s.endValue - s.amount) / s.amount) * 100 : null;
                    const returnColor = returnPct != null ? (returnPct >= 0 ? '#16a34a' : '#dc2626') : undefined;
                    const xirrColor = s.xirr != null ? (s.xirr >= 0 ? '#16a34a' : '#dc2626') : undefined;
                    return [
                      s.ticker,
                      s.amount.toLocaleString('en-US', { minimumFractionDigits: 2 }),
                      s.units!.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 }),
                      s.endValue != null ? s.endValue.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—',
                      returnPct != null ? (
                        <span style={{ color: returnColor }}>{returnPct >= 0 ? '+' : ''}{returnPct.toFixed(1)}%</span>
                      ) : (
                        '—'
                      ),
                      s.xirr != null ? (
                        <span style={{ color: xirrColor }}>{(s.xirr * 100).toFixed(1)}%</span>
                      ) : (
                        '—'
                      ),
                    ];
                  })}
                  divider="horizontal"
                  size="compact"
                />
                <Block marginTop="scale400" paddingTop="scale300" $style={{ borderTop: '1px solid #e5e7eb' }}>
                  <ParagraphMedium marginTop="0" marginBottom="0">
                    Total: <strong>${result.totalInvestment.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> →{' '}
                    <strong>${result.totalEndValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                    {result.totalInvestment > 0 && (
                      <span style={{ color: result.totalEndValue >= result.totalInvestment ? '#16a34a' : '#dc2626' }}>
                        {' '}({(result.totalEndValue >= result.totalInvestment ? '+' : '')}
                        {(((result.totalEndValue - result.totalInvestment) / result.totalInvestment) * 100).toFixed(1)}%)
                      </span>
                    )}
                    {result.totalXirr != null && (
                      <span style={{ color: result.totalXirr >= 0 ? '#16a34a' : '#dc2626', marginLeft: '8px' }}>
                        · XIRR: {(result.totalXirr * 100).toFixed(1)}%
                      </span>
                    )}
                  </ParagraphMedium>
                </Block>
              </Block>
            ) : null
          )}

          {portfolioValueSeries.length > 0 && (
            <>
              <StockPortfolioValueChart
                key={chartKey}
                series={portfolioValueSeries}
              />
              <StockPortfolioValueNormalizedChart
                key={chartKey}
                series={portfolioValueSeries}
              />
            </>
          )}

          {chartSeries.length > 0 && (
            <>
              <StockPriceChart key={chartKey} series={chartSeries} colors={COLORS} />
              <StockPriceNormalizedChart key={chartKey} series={chartSeries} colors={COLORS} />
            </>
          )}
        </Block>
      )}
    </Block>
  );
};
