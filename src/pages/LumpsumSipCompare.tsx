import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { Input } from 'baseui/input';
import { Table } from 'baseui/table-semantic';
import { LabelMedium, ParagraphMedium } from 'baseui/typography';
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import xirr from 'xirr';
import { LoadingOverlay } from '../components/common/LoadingOverlay';
import { StockPortfolioValueChart } from '../components/charts/StockPortfolioValueChart';
import { StockPortfolioValueNormalizedChart } from '../components/charts/StockPortfolioValueNormalizedChart';
import { yahooFinanceService } from '../services/yahooFinanceService';
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

function localMonthEndDateTime(monthStr: string): Date {
  const [y, m] = monthStr.split('-').map(Number);
  const lastDayNum = new Date(y, m, 0).getDate();
  return new Date(y, m - 1, lastDayNum, 23, 59, 59, 999);
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

/* ─────────────── types ─────────────── */

interface PortfolioEntry {
  id: string;
  ticker: string;
  amount: string; // total amount for comparison
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

/* ─────────────── URL serialization ─────────────── */

function parseCompareParams(searchParams: URLSearchParams): {
  portfolios: PortfolioDef[];
  startMonth: string;
  endMonth: string;
} | null {
  const pa = searchParams.get('pa');
  const pb = searchParams.get('pb');
  const startMonth = searchParams.get('startMonth');
  const endMonth = searchParams.get('endMonth');
  if (!pa && !pb && !startMonth && !endMonth) return null;

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
  if (entriesA.length === 0 && entriesB.length === 0 && !startMonth && !endMonth) return null;

  return {
    portfolios: [
      { id: 'A', name: 'Portfolio A', entries: entriesA.length ? entriesA : [{ id: crypto.randomUUID?.() ?? '1', ticker: '', amount: '' }] },
      { id: 'B', name: 'Portfolio B', entries: entriesB.length ? entriesB : [{ id: crypto.randomUUID?.() ?? '2', ticker: '', amount: '' }] },
    ],
    startMonth: startMonth && /^\d{4}-\d{2}$/.test(startMonth) ? startMonth : defaultStartMonth(),
    endMonth: endMonth && /^\d{4}-\d{2}$/.test(endMonth) ? endMonth : defaultEndMonth(),
  };
}

function serializeCompareParams(
  portfolios: PortfolioDef[],
  startMonth: string,
  endMonth: string
): URLSearchParams {
  const params = new URLSearchParams();
  const entriesToStr = (entries: PortfolioEntry[]) =>
    entries.filter((e) => e.ticker.trim() || parseFloat(e.amount) > 0).map((e) => `${e.ticker}:${e.amount}`).join(',');
  const pa = entriesToStr(portfolios[0]?.entries ?? []);
  const pb = entriesToStr(portfolios[1]?.entries ?? []);
  if (pa) params.set('pa', pa);
  if (pb) params.set('pb', pb);
  params.set('startMonth', startMonth);
  params.set('endMonth', endMonth);
  return params;
}

/* ─────────────── UI Styles ─────────────── */

const dateInputStyle = {
  padding: '8px 12px',
  borderRadius: '4px',
  border: '1px solid #e5e7eb',
  fontSize: '14px',
  fontFamily: 'inherit' as const,
};

/* ─────────────── Portfolio Section ─────────────── */

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

/* ─────────────── Main Component ─────────────── */

export default function LumpsumSipCompare(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFromUrl = useMemo(() => parseCompareParams(searchParams), [searchParams.toString()]);

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
  const [startMonth, setStartMonth] = useState<string>(() => initialFromUrl?.startMonth ?? defaultStartMonth());
  const [endMonth, setEndMonth] = useState<string>(() => initialFromUrl?.endMonth ?? defaultEndMonth());
  const [hasResults, setHasResults] = useState(false);

  useEffect(() => {
    if (initialFromUrl) {
      setPortfolios(initialFromUrl.portfolios);
      setStartMonth(initialFromUrl.startMonth);
      setEndMonth(initialFromUrl.endMonth);
    }
  }, [searchParams.toString()]);

  const isRangeInvalid = startMonth > endMonth;

  const allValidEntries = portfolios.flatMap((p) =>
    p.entries
      .filter((e) => e.ticker.trim() && parseFloat(e.amount) > 0)
      .map((e) => ({ ...e, portfolioId: p.id, portfolioName: p.name }))
  );
  const hasValidEntries = allValidEntries.length > 0;
  const uniqueTickers = [...new Set(allValidEntries.map((e) => e.ticker.trim().toUpperCase()))];

  const startDateStr = monthToStartDate(startMonth);
  const endDateStr = monthToEndDate(endMonth);

  const handleAddRow = (portfolioId: string) => {
    setPortfolios((prev) =>
      prev.map((p) =>
        p.id === portfolioId
          ? { ...p, entries: [...p.entries, { id: crypto.randomUUID?.() ?? String(Date.now()), ticker: '', amount: '' }] }
          : p
      )
    );
  };

  const handleRemoveRow = (portfolioId: string, entryId: string) => {
    setPortfolios((prev) =>
      prev.map((p) =>
        p.id === portfolioId && p.entries.length > 1 ? { ...p, entries: p.entries.filter((e) => e.id !== entryId) } : p
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
                  ? { ...e, [field]: field === 'ticker' ? value.toUpperCase() : value.replace(/[^0-9.]/g, '') }
                  : e
              ),
            }
          : p
      )
    );
  };

  const handlePlot = async () => {
    if (!hasValidEntries || isRangeInvalid) return;

    setLoading(true);
    setPriceDataByTicker({});
    setHasResults(false);
    try {
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

      syntheticTickers.forEach(({ ticker, parsed }) => {
        byTicker[ticker] = generateSyntheticPriceData(startDateStr, endDateStr, parsed.rate);
      });

      setPriceDataByTicker(byTicker);
      setHasResults(true);
      setSearchParams(serializeCompareParams(portfolios, startMonth, endMonth), { replace: true });
    } catch (error) {
      console.error('Error fetching stock prices:', error);
    } finally {
      setLoading(false);
    }
  };

  const months = getMonthsBetween(startMonth, endMonth);

  /* ─────────────── Compute Results ─────────────── */

  const portfolioResults = portfolios.map((p) => {
    const validEntries = p.entries.filter((e) => e.ticker.trim() && parseFloat(e.amount) > 0);

    /* -- LUMPSUM side -- */
    const lumpsumInvestDate = new Date(startMonth + '-01T12:00:00Z');
    const lumpsumEndDate = new Date(endDateStr + 'T23:59:59Z');

    const lumpsumDetails = validEntries.map((e) => {
      const ticker = e.ticker.trim().toUpperCase();
      const totalAmt = parseFloat(e.amount) || 0;
      const data = priceDataByTicker[ticker];
      const startPrice = data?.length ? getPriceAtDate(data, lumpsumInvestDate) : 0;
      const endPrice = data?.length ? getPriceAtDate(data, lumpsumEndDate) : 0;
      const units = startPrice > 0 ? totalAmt / startPrice : 0;
      const endValue = units * endPrice;
      return { ticker, amount: totalAmt, startPrice, endPrice, units, endValue };
    }).filter((s) => s.units > 0);

    const lumpsumTotalInvested = lumpsumDetails.reduce((s, d) => s + d.amount, 0);
    const lumpsumTotalEndValue = lumpsumDetails.reduce((s, d) => s + d.endValue, 0);

    let lumpsumXirr: number | null = null;
    if (lumpsumTotalInvested > 0) {
      try {
        lumpsumXirr = xirr([
          { amount: -lumpsumTotalInvested, when: lumpsumInvestDate },
          { amount: lumpsumTotalEndValue, when: lumpsumEndDate },
        ]);
      } catch { /* ignore */ }
    }

    // Lumpsum value over time (daily portfolio value)
    const lumpsumValueData: Array<{ date: Date; value: number }> = [];
    if (lumpsumDetails.length > 0) {
      const allDates = new Set<number>();
      lumpsumDetails.forEach((d) => {
        const data = priceDataByTicker[d.ticker];
        data?.forEach((pt) => allDates.add(pt.date.getTime()));
      });
      const sortedDates = Array.from(allDates).sort((a, b) => a - b);
      sortedDates.forEach((ts) => {
        const date = new Date(ts);
        const value = lumpsumDetails.reduce((sum, d) => {
          const data = priceDataByTicker[d.ticker];
          if (!data) return sum;
          return sum + d.units * getPriceAtDate(data, date);
        }, 0);
        lumpsumValueData.push({ date, value });
      });
    }

    /* -- SIP side -- */
    const sipTransactions: Array<{ amount: number; when: Date }> = [];
    const sipUnitsByTicker: Record<string, number> = {};
    let sipTotalInvested = 0;

    validEntries.forEach((e) => {
      const ticker = e.ticker.trim().toUpperCase();
      const totalAmt = parseFloat(e.amount) || 0;
      const monthlyAmount = months.length > 0 ? totalAmt / months.length : 0;
      sipUnitsByTicker[ticker] = 0;

      months.forEach((monthStr) => {
        const investDate = new Date(monthStr + '-01T12:00:00Z');
        const data = priceDataByTicker[ticker];
        if (!data || data.length === 0) return;
        const price = getPriceAtDate(data, investDate);
        if (price > 0 && monthlyAmount > 0) {
          sipUnitsByTicker[ticker] += monthlyAmount / price;
          sipTotalInvested += monthlyAmount;
          sipTransactions.push({ amount: -monthlyAmount, when: investDate });
        }
      });
    });

    const sipEndDate = new Date(endDateStr + 'T23:59:59Z');
    const sipDetails = validEntries.map((e) => {
      const ticker = e.ticker.trim().toUpperCase();
      const totalAmt = parseFloat(e.amount) || 0;
      const monthlyAmount = months.length > 0 ? totalAmt / months.length : 0;
      const data = priceDataByTicker[ticker];
      const units = sipUnitsByTicker[ticker] ?? 0;
      const endPrice = data?.length ? getPriceAtDate(data, sipEndDate) : 0;
      const endValue = units * endPrice;
      const invested = monthlyAmount * months.length;
      return { ticker, amount: invested, monthlyAmount, units, endValue };
    }).filter((s) => s.units > 0);

    const sipTotalEndValue = sipDetails.reduce((s, d) => s + d.endValue, 0);

    // Aggregate SIP transactions for XIRR
    sipTransactions.sort((a, b) => a.when.getTime() - b.when.getTime());
    const uniqueByDate = new Map<string, number>();
    sipTransactions.forEach((t) => {
      const key = t.when.toISOString().slice(0, 10);
      uniqueByDate.set(key, (uniqueByDate.get(key) ?? 0) + t.amount);
    });
    const xirrTransactions = [
      ...Array.from(uniqueByDate.entries()).map(([d, amt]) => ({ amount: amt, when: new Date(d) })),
      { amount: sipTotalEndValue, when: sipEndDate },
    ].sort((a, b) => a.when.getTime() - b.when.getTime());

    let sipXirr: number | null = null;
    try {
      sipXirr = xirr(xirrTransactions);
    } catch { /* ignore */ }

    // SIP value over time (monthly portfolio value with cumulative units)
    const sipValueData: Array<{ date: Date; value: number }> = [];
    const sipCumulativeUnitsByTicker: Record<string, number> = {};

    months.forEach((monthStr) => {
      const lastDay = localMonthEndDateTime(monthStr);
      const investDate = new Date(monthStr + '-01T12:00:00Z');

      validEntries.forEach((e) => {
        const ticker = e.ticker.trim().toUpperCase();
        const totalAmt = parseFloat(e.amount) || 0;
        const monthlyAmount = months.length > 0 ? totalAmt / months.length : 0;
        const data = priceDataByTicker[ticker];
        if (!data || data.length === 0) return;
        const price = getPriceAtDate(data, investDate);
        if (price > 0 && monthlyAmount > 0) {
          sipCumulativeUnitsByTicker[ticker] = (sipCumulativeUnitsByTicker[ticker] ?? 0) + monthlyAmount / price;
        }
      });

      const value = Object.entries(sipCumulativeUnitsByTicker).reduce((sum, [ticker, units]) => {
        const data = priceDataByTicker[ticker];
        if (!data) return sum;
        return sum + units * getPriceAtDate(data, lastDay);
      }, 0);

      sipValueData.push({ date: lastDay, value });
    });

    // Monthly breakdown (SIP)
    const monthlyBreakdown: Array<{
      month: string;
      ticker: string;
      price: number;
      monthEndPrice: number;
      sipAmount: number;
      unitsBought: number;
      accumulatedUnits: number;
      investment: number;
      cumulativeInvested: number;
      value: number;
      returnPct: number | null;
    }> = [];
    const bdCumulativeUnits: Record<string, number> = {};
    let bdCumulativeInvested = 0;

    months.forEach((monthStr) => {
      const lastDay = localMonthEndDateTime(monthStr);
      const investDate = new Date(monthStr + '-01T12:00:00Z');
      let monthInvestment = 0;

      validEntries.forEach((e) => {
        const ticker = e.ticker.trim().toUpperCase();
        const totalAmt = parseFloat(e.amount) || 0;
        const monthlyAmount = months.length > 0 ? totalAmt / months.length : 0;
        const data = priceDataByTicker[ticker];
        if (!data || data.length === 0) return;
        const price = getPriceAtDate(data, investDate);
        if (price > 0 && monthlyAmount > 0) {
          const unitsBought = monthlyAmount / price;
          bdCumulativeUnits[ticker] = (bdCumulativeUnits[ticker] ?? 0) + unitsBought;
          monthInvestment += monthlyAmount;
        }
      });
      bdCumulativeInvested += monthInvestment;

      const value = Object.entries(bdCumulativeUnits).reduce((sum, [ticker, units]) => {
        const data = priceDataByTicker[ticker];
        if (!data) return sum;
        return sum + units * getPriceAtDate(data, lastDay);
      }, 0);
      const returnPct = bdCumulativeInvested > 0 ? ((value - bdCumulativeInvested) / bdCumulativeInvested) * 100 : null;

      validEntries.forEach((e) => {
        const ticker = e.ticker.trim().toUpperCase();
        const totalAmt = parseFloat(e.amount) || 0;
        const monthlyAmount = months.length > 0 ? totalAmt / months.length : 0;
        const data = priceDataByTicker[ticker];
        if (!data || data.length === 0) return;
        const price = getPriceAtDate(data, investDate);
        const monthEndPrice = getPriceAtDate(data, lastDay);
        const unitsBought = price > 0 && monthlyAmount > 0 ? monthlyAmount / price : 0;
        const accumulatedUnits = bdCumulativeUnits[ticker] ?? 0;
        monthlyBreakdown.push({
          month: monthStr,
          ticker,
          price,
          monthEndPrice,
          sipAmount: monthlyAmount,
          unitsBought,
          accumulatedUnits,
          investment: monthInvestment,
          cumulativeInvested: bdCumulativeInvested,
          value,
          returnPct,
        });
      });
    });

    return {
      portfolio: p,
      lumpsumDetails,
      lumpsumTotalInvested,
      lumpsumTotalEndValue,
      lumpsumXirr,
      lumpsumValueData,
      sipDetails,
      sipTotalInvested,
      sipTotalEndValue,
      sipXirr,
      sipValueData,
      monthlyBreakdown,
    };
  });

  /* ─────────────── Chart series ─────────────── */

  // Lumpsum chart series
  const lumpsumChartSeries = portfolioResults
    .filter((r) => r.lumpsumValueData.length > 0)
    .map((r) => ({ name: `${r.portfolio.name} (Lumpsum)`, data: r.lumpsumValueData }));

  // SIP chart series
  const sipChartSeries = portfolioResults
    .filter((r) => r.sipValueData.length > 0)
    .map((r) => ({ name: `${r.portfolio.name} (SIP)`, data: r.sipValueData }));

  // Combined: all series together
  const combinedChartSeries = [...lumpsumChartSeries, ...sipChartSeries];

  const hasAnyChartData = hasResults && combinedChartSeries.length > 0;

  /* ─────────────── Render ─────────────── */

  return (
    <Block position="relative">
      <LoadingOverlay active={loading} />

      <Block maxWidth="900px" margin="0 auto" marginBottom="scale400" paddingTop="0" display="flex" justifyContent="center">
        <ParagraphMedium color="contentTertiary" marginTop="0" marginBottom="0">
          Compare Lumpsum vs SIP for each portfolio. Enter total amount per stock — Lumpsum invests it all at start, SIP splits equally across months. Use ~12 for 12% synthetic ticker.
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
          <Block display="flex" flexDirection={['column', 'column', 'row']} gridGap="scale600" $style={{ flexWrap: 'wrap' }}>
            {portfolios.map((portfolio, idx) => (
              <Block
                key={portfolio.id}
                flex="1"
                overrides={{ Block: { style: { minWidth: '280px' } } }}
              >
                <PortfolioSection
                  portfolio={portfolio}
                  onUpdate={(id, field, value) => handleUpdateEntry(portfolio.id, id, field, value)}
                  onAddRow={() => handleAddRow(portfolio.id)}
                  onRemoveRow={(id) => handleRemoveRow(portfolio.id, id)}
                  borderColor={idx === 0 ? '#6366f1' : '#ec4899'}
                />
              </Block>
            ))}
          </Block>
          <Block display="flex" alignItems="center" gridGap="scale300" marginTop="scale400" $style={{ flexWrap: 'wrap' }}>
            <LabelMedium marginBottom="0" marginTop="0">Start Month</LabelMedium>
            <input
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              style={dateInputStyle}
            />
            <LabelMedium marginBottom="0" marginTop="0">End Month</LabelMedium>
            <input
              type="month"
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              style={dateInputStyle}
            />
            <Button kind="primary" onClick={handlePlot} disabled={!hasValidEntries || isRangeInvalid}>
              Compare
            </Button>
            {isRangeInvalid && (
              <LabelMedium marginBottom="0" marginTop="0" overrides={{ Block: { style: ({ $theme }) => ({ color: $theme.colors.negative }) } }}>
                Start month must be before end month
              </LabelMedium>
            )}
          </Block>
        </Block>
      </Block>

      {hasAnyChartData && (
        <Block maxWidth="90%" margin="0 auto">
          {/* Summary comparison table per portfolio */}
          {portfolioResults.map((result) => {
            const hasLumpsum = result.lumpsumDetails.length > 0;
            const hasSip = result.sipDetails.length > 0;
            if (!hasLumpsum && !hasSip) return null;

            const lumpsumReturnPct = result.lumpsumTotalInvested > 0
              ? ((result.lumpsumTotalEndValue - result.lumpsumTotalInvested) / result.lumpsumTotalInvested) * 100
              : null;
            const sipReturnPct = result.sipTotalInvested > 0
              ? ((result.sipTotalEndValue - result.sipTotalInvested) / result.sipTotalInvested) * 100
              : null;

            return (
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
                  {result.portfolio.name} — Lumpsum vs SIP Comparison
                </LabelMedium>
                <Table
                  columns={['Scenario', 'Total Invested ($)', 'End Value ($)', 'Return (%)', 'XIRR (%)']}
                  data={[
                    [
                      'Lumpsum (all at start)',
                      result.lumpsumTotalInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                      result.lumpsumTotalEndValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                      lumpsumReturnPct != null ? (
                        <span style={{ color: lumpsumReturnPct >= 0 ? '#16a34a' : '#dc2626' }}>
                          {lumpsumReturnPct >= 0 ? '+' : ''}{lumpsumReturnPct.toFixed(2)}%
                        </span>
                      ) : '—',
                      result.lumpsumXirr != null ? (
                        <span style={{ color: result.lumpsumXirr >= 0 ? '#16a34a' : '#dc2626' }}>
                          {(result.lumpsumXirr * 100).toFixed(2)}%
                        </span>
                      ) : '—',
                    ],
                    [
                      'SIP (equal monthly)',
                      result.sipTotalInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                      result.sipTotalEndValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                      sipReturnPct != null ? (
                        <span style={{ color: sipReturnPct >= 0 ? '#16a34a' : '#dc2626' }}>
                          {sipReturnPct >= 0 ? '+' : ''}{sipReturnPct.toFixed(2)}%
                        </span>
                      ) : '—',
                      result.sipXirr != null ? (
                        <span style={{ color: result.sipXirr >= 0 ? '#16a34a' : '#dc2626' }}>
                          {(result.sipXirr * 100).toFixed(2)}%
                        </span>
                      ) : '—',
                    ],
                  ]}
                  divider="horizontal"
                  size="compact"
                />
                <Block marginTop="scale400" paddingTop="scale300" $style={{ borderTop: '1px solid #e5e7eb' }}>
                  <ParagraphMedium marginTop="0" marginBottom="0">
                    <strong>Winner:</strong>{' '}
                    {result.lumpsumTotalEndValue > result.sipTotalEndValue ? (
                      <span style={{ color: '#6366f1', fontWeight: 600 }}>
                        Lumpsum (+${(result.lumpsumTotalEndValue - result.sipTotalEndValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} more)
                      </span>
                    ) : result.sipTotalEndValue > result.lumpsumTotalEndValue ? (
                      <span style={{ color: '#ec4899', fontWeight: 600 }}>
                        SIP (+${(result.sipTotalEndValue - result.lumpsumTotalEndValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} more)
                      </span>
                    ) : (
                      <span style={{ fontWeight: 600 }}>Tie</span>
                    )}
                  </ParagraphMedium>
                </Block>

                {/* Per-stock breakdown — Lumpsum */}
                {result.lumpsumDetails.length > 1 && (
                  <Block marginTop="scale500">
                    <LabelMedium marginBottom="scale200" $style={{ fontWeight: 500, fontSize: '13px' }}>
                      Lumpsum Breakdown (per stock)
                    </LabelMedium>
                    <Table
                      columns={['Ticker', 'Invested ($)', 'Units', 'End Value ($)', 'Return (%)']}
                      data={result.lumpsumDetails.map((d) => {
                        const retPct = d.amount > 0 ? ((d.endValue - d.amount) / d.amount) * 100 : null;
                        return [
                          d.ticker,
                          d.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                          d.units.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 }),
                          d.endValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                          retPct != null ? (
                            <span style={{ color: retPct >= 0 ? '#16a34a' : '#dc2626' }}>
                              {retPct >= 0 ? '+' : ''}{retPct.toFixed(2)}%
                            </span>
                          ) : '—',
                        ];
                      })}
                      divider="horizontal"
                      size="compact"
                    />
                  </Block>
                )}

                {/* Per-stock breakdown — SIP */}
                {result.sipDetails.length > 1 && (
                  <Block marginTop="scale500">
                    <LabelMedium marginBottom="scale200" $style={{ fontWeight: 500, fontSize: '13px' }}>
                      SIP Breakdown (per stock)
                    </LabelMedium>
                    <Table
                      columns={['Ticker', 'Invested ($)', '$/mo', 'Units', 'End Value ($)', 'Return (%)']}
                      data={result.sipDetails.map((d) => {
                        const retPct = d.amount > 0 ? ((d.endValue - d.amount) / d.amount) * 100 : null;
                        return [
                          d.ticker,
                          d.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                          d.monthlyAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                          d.units.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 }),
                          d.endValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                          retPct != null ? (
                            <span style={{ color: retPct >= 0 ? '#16a34a' : '#dc2626' }}>
                              {retPct >= 0 ? '+' : ''}{retPct.toFixed(2)}%
                            </span>
                          ) : '—',
                        ];
                      })}
                      divider="horizontal"
                      size="compact"
                    />
                  </Block>
                )}
              </Block>
            );
          })}

          {/* Charts: Combined Lumpsum & SIP value over time */}
          {combinedChartSeries.length > 0 && (
            <>
              <StockPortfolioValueChart
                key="compare-value"
                series={combinedChartSeries}
                title="Lumpsum vs SIP – Portfolio Value"
                yAxisTitle="Value ($)"
              />
              <StockPortfolioValueNormalizedChart
                key="compare-normalized"
                series={combinedChartSeries}
              />
            </>
          )}

          {/* SIP Monthly Breakdown Tables */}
          {portfolioResults.filter((r) => r.monthlyBreakdown.length > 0).map((result) => (
            <Block
              key={result.portfolio.id}
              marginTop="scale700"
              padding="scale500"
              backgroundColor="backgroundSecondary"
              overrides={{
                Block: {
                  style: ({ $theme }) => ({
                    borderRadius: $theme.borders.radius200,
                    overflowX: 'auto',
                  }),
                },
              }}
            >
              <LabelMedium marginBottom="scale400" $style={{ fontWeight: 600 }}>
                {result.portfolio.name} – SIP Calculation Breakdown
              </LabelMedium>
              <ParagraphMedium marginTop="0" marginBottom="scale300" color="contentSecondary" $style={{ fontSize: '13px' }}>
                Per ticker: Price ($) = on SIP date (1st of month); Month-end price ($) = on last calendar day of month. Value ($) is the portfolio total. Investment/Cumulative/Return are portfolio totals.
              </ParagraphMedium>
              <Table
                columns={[
                  'Month',
                  'Ticker',
                  'Price ($)',
                  'SIP Amount ($)',
                  'Units Bought',
                  'Accumulated Units',
                  'Investment ($)',
                  'Cumulative ($)',
                  'Month-end price ($)',
                  'Value ($)',
                  'Return (%)',
                ]}
                data={result.monthlyBreakdown.map((row) => [
                  row.month,
                  row.ticker,
                  row.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  row.sipAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  row.unitsBought.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  row.accumulatedUnits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  row.investment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  row.cumulativeInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  row.monthEndPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  row.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  row.returnPct != null ? (
                    <span style={{ color: row.returnPct >= 0 ? '#16a34a' : '#dc2626' }}>
                      {(row.returnPct >= 0 ? '+' : '')}{row.returnPct.toFixed(2)}%
                    </span>
                  ) : (
                    '—'
                  ),
                ])}
                divider="horizontal"
                size="compact"
              />
            </Block>
          ))}
        </Block>
      )}
    </Block>
  );
}
