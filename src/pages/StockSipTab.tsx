import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import xirr from 'xirr';
import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { Input } from 'baseui/input';
import { LabelMedium, ParagraphMedium } from 'baseui/typography';
import { Table } from 'baseui/table-semantic';
import { LoadingOverlay } from '../components/common/LoadingOverlay';
import { PageCard, PageIntro } from '../components/common/PageChrome';
import { splitTickerAmountSegment } from '../utils/browser/tickerAmountUrl';
import { fillMissingNavDates } from '../utils/data/fillMissingNavDates';
import { yahooFinanceService } from '../services/yahooFinanceService';
import { StockPortfolioValueChart } from '../components/charts/StockPortfolioValueChart';
import { StockPortfolioValueNormalizedChart } from '../components/charts/StockPortfolioValueNormalizedChart';

function getPriceAtDate(data: Array<{ date: Date; nav: number }>, targetDate: Date): number {
  const t = targetDate.getTime();
  let last = data[0];
  for (const p of data) {
    if (p.date.getTime() <= t) last = p;
    else break;
  }
  return last.nav;
}

/**
 * End of the last calendar day for YYYY-MM in local time. Using start-of-day made
 * getPriceAtDate miss same-day closes (e.g. Jan 31 close is after Jan 31 00:00).
 */
function localMonthEndDateTime(monthStr: string): Date {
  const [y, m] = monthStr.split('-').map(Number);
  const lastDayNum = new Date(y, m, 0).getDate();
  return new Date(y, m - 1, lastDayNum, 23, 59, 59, 999);
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

function formatDateForDisplay(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : 'N/A';
}

/**
 * Normalize date to start of UTC day (00:00:00.000 UTC).
 * Ensures consistent date comparisons regardless of time component.
 */
function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
}

/**
 * Check if two dates represent the same calendar day (ignoring time).
 */
function isSameCalendarDay(date1: Date, date2: Date): boolean {
  return startOfUTCDay(date1).getTime() === startOfUTCDay(date2).getTime();
}

/**
 * Normalize and sort price data by date.
 * Converts all dates to UTC day boundaries and sorts chronologically.
 * This prevents timezone-related date comparison bugs.
 */
function normalizePriceData(data: Array<{ date: Date; nav: number }>): Array<{ date: Date; nav: number }> {
  return data
    .map((entry) => ({
      date: startOfUTCDay(entry.date),
      nav: entry.nav,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Get the next trading day (skip weekends: Saturday=6, Sunday=0).
 * If the date is a weekday, return it; if weekend, return the following Monday.
 */
function getNextTradingDay(date: Date): Date {
  // Clone the date to avoid mutations
  const tradingDate = new Date(date.getTime());
  let dayOfWeek = tradingDate.getUTCDay();
  
  // Skip weekends: if Sunday (0), move to Monday; if Saturday (6), move to Monday
  while (dayOfWeek === 0 || dayOfWeek === 6) {
    tradingDate.setUTCDate(tradingDate.getUTCDate() + 1);
    dayOfWeek = tradingDate.getUTCDay();
  }
  
  return tradingDate;
}

/**
 * Find the first available date in price data for the target month.
 * Returns the earliest date Yahoo Finance has for that month.
 * No weekend/holiday logic - just the first date that exists in that month.
 */
function getFirstAvailableTradingDate(targetDate: Date, priceData: Array<{ date: Date; nav: number }>): Date {
  if (!priceData || priceData.length === 0) return targetDate;
  
  const targetMonth = targetDate.getUTCMonth();
  const targetYear = targetDate.getUTCFullYear();
  
  // Find first date in priceData that matches the target month
  for (const entry of priceData) {
    if (
      entry.date.getUTCFullYear() === targetYear &&
      entry.date.getUTCMonth() === targetMonth
    ) {
      return entry.date;  // Return first date in that month
    }
  }
  
  // Fallback: return first available data if month not found
  return priceData[0].date;
}

/**
 * Add months to a date, handling the same day in the target month.
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

interface SipTransaction {
  userInvestDate: string;
  actualBuyDate: Date | null;
  actualSellDate: Date | null;
  ticker: string;
  buyPrice: number;
  sipAmount: number;
  units: number;
  endDate: string;
  endPrice: number;
  endValue: number;
  returnAmount: number;
  returnPercent: number;
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

/** Parse from URL: pa=ticker:amt,ticker:amt&pb=...&startMonth=YYYY-MM&endMonth=YYYY-MM */
function parseStockSipParams(searchParams: URLSearchParams): {
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
      const { ticker, amount } = splitTickerAmountSegment(part);
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

function serializeStockSipParams(
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

const dateInputStyle = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '14px',
  fontFamily: 'inherit' as const,
  backgroundColor: '#fff',
};

function defaultStartMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 11);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function defaultEndMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

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
            <LabelMedium marginBottom="0" marginTop="0">$/mo</LabelMedium>
            <Input
              value={entry.amount}
              onChange={(e) => onUpdate(entry.id, 'amount', (e.target as HTMLInputElement).value.replace(/[^0-9.]/g, ''))}
              placeholder="Monthly"
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

export function StockSipTab(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFromUrl = useMemo(() => parseStockSipParams(searchParams), [searchParams.toString()]);

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
            // Use only actual Yahoo Finance dates (don't fill missing dates)
            // This ensures first date of month is actually from Yahoo, not forward-filled
            byTicker[realTickers[i]] = normalizePriceData(result.value);
          }
        });
      }

      syntheticTickers.forEach(({ ticker, parsed }) => {
        byTicker[ticker] = normalizePriceData(generateSyntheticPriceData(startDateStr, endDateStr, parsed.rate));
      });

      setPriceDataByTicker(byTicker);
      setSearchParams(serializeStockSipParams(portfolios, startMonth, endMonth), { replace: true });
    } catch (error) {
      console.error('Error fetching stock prices:', error);
    } finally {
      setLoading(false);
    }
  };

  const months = getMonthsBetween(startMonth, endMonth);
  const endDate = new Date(endDateStr + 'T23:59:59Z');

  const portfolioResults = portfolios.map((p) => {
    const validEntries = p.entries.filter((e) => e.ticker.trim() && parseFloat(e.amount) > 0);
    let totalInvested = 0;

    // Build transaction-level summary first (for XIRR calculation)
    const transactions: SipTransaction[] = [];
    
    validEntries.forEach((e) => {
      const ticker = e.ticker.trim().toUpperCase();
      const monthlyAmount = parseFloat(e.amount) || 0;
      const data = priceDataByTicker[ticker];

      months.forEach((monthStr) => {
        const userInvestDateStr = monthToStartDate(monthStr);
        const userInvestDate = new Date(monthStr + '-01T12:00:00Z');
        if (!data || data.length === 0) return;
        const actualBuyDate = getFirstAvailableTradingDate(userInvestDate, data);

        const buyPrice = getPriceAtDate(data, actualBuyDate);
        if (buyPrice > 0 && monthlyAmount > 0) {
          // Sell exactly 1 month after buy
          const sellDate = addMonths(actualBuyDate, 1);
          const actualSellDate = getFirstAvailableTradingDate(sellDate, data);
          const endPrice = getPriceAtDate(data, actualSellDate);
          const units = monthlyAmount / buyPrice;
          const endValue = units * endPrice;
          const returnAmount = endValue - monthlyAmount;
          const returnPercent = monthlyAmount > 0 ? (returnAmount / monthlyAmount) * 100 : 0;

          transactions.push({
            userInvestDate: userInvestDateStr,
            actualBuyDate,
            actualSellDate,
            ticker,
            buyPrice,
            sipAmount: monthlyAmount,
            units,
            endDate: formatDateForDisplay(actualSellDate),
            endPrice,
            endValue,
            returnAmount,
            returnPercent,
          });
          
          totalInvested += monthlyAmount;
        }
      });
    });

    // Build summary with XIRR calculations
    const summary = validEntries
      .map((e) => {
        const ticker = e.ticker.trim().toUpperCase();
        const monthlyAmount = parseFloat(e.amount) || 0;
        const tickerTransactions = transactions.filter((t) => t.ticker === ticker);
        
        if (tickerTransactions.length === 0) return null;

        const invested = tickerTransactions.reduce((sum, t) => sum + t.sipAmount, 0);
        const endValue = tickerTransactions.reduce((sum, t) => sum + t.endValue, 0);
        const totalUnits = tickerTransactions.reduce((sum, t) => sum + t.units, 0);
        const returnPct = invested > 0 ? ((endValue - invested) / invested) * 100 : null;

        // Calculate XIRR for this ticker's SIP transactions
        let tickerXirr: number | null = null;
        if (tickerTransactions.length > 0 && invested > 0) {
          try {
            const xirrData = tickerTransactions
              .map((t) => [
                { amount: -t.sipAmount, when: t.actualBuyDate || new Date() },
                { amount: t.endValue, when: t.actualSellDate || new Date() },
              ])
              .flat()
              .sort((a, b) => a.when.getTime() - b.when.getTime());
            tickerXirr = xirr(xirrData);
          } catch {
            // ignore XIRR calculation errors
          }
        }

        return {
          ticker,
          amount: invested,
          monthlyAmount,
          units: totalUnits,
          endValue,
          returnPct,
          firstMonth: months[0],
          lastMonth: months[months.length - 1],
          firstPrice: tickerTransactions[0]?.buyPrice ?? 0,
          lastPrice: tickerTransactions[tickerTransactions.length - 1]?.endPrice ?? 0,
          xirr: tickerXirr,
        };
      })
      .filter((s): s is Exclude<typeof s, null> => s !== null);

    // Calculate total XIRR for portfolio
    let totalXirr: number | null = null;
    let totalEndValue = 0;
    if (transactions.length > 0) {
      try {
        const xirrTransactions = transactions
          .map((t) => [
            { amount: -t.sipAmount, when: t.actualBuyDate || new Date() },
            { amount: t.endValue, when: t.actualSellDate || new Date() },
          ])
          .flat()
          .sort((a, b) => a.when.getTime() - b.when.getTime());
        totalXirr = xirr(xirrTransactions);
        totalEndValue = transactions.reduce((sum, t) => sum + t.endValue, 0);
      } catch {
        // ignore
      }
    }

    // Build valueData with open positions at each month-end
    const valueData: Array<{ date: Date; value: number }> = [];
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

    months.forEach((monthStr) => {
      const lastDay = localMonthEndDateTime(monthStr);
      const monthEndDate = new Date(monthStr + '-01T12:00:00Z');
      
      // Find all transactions that are open on this date (bought <= this date, sold > this date)
      const openTransactions = transactions.filter((t) => {
        const buyDate = t.actualBuyDate ? t.actualBuyDate.getTime() : 0;
        const sellDate = t.actualSellDate ? t.actualSellDate.getTime() : Infinity;
        return buyDate <= lastDay.getTime() && sellDate > lastDay.getTime();
      });

      // Calculate portfolio value from open positions
      let monthValue = 0;
      const transactionsByTicker: Record<string, typeof transactions> = {};
      const unitsByTicker: Record<string, number> = {};

      openTransactions.forEach((t) => {
        if (!transactionsByTicker[t.ticker]) transactionsByTicker[t.ticker] = [];
        transactionsByTicker[t.ticker].push(t);
        unitsByTicker[t.ticker] = (unitsByTicker[t.ticker] ?? 0) + t.units;
        
        const data = priceDataByTicker[t.ticker];
        if (data) {
          const priceOnLastDay = getPriceAtDate(data, lastDay);
          monthValue += t.units * priceOnLastDay;
        }
      });

      const cumulativeInvested = transactions
        .filter((t) => t.actualBuyDate && t.actualBuyDate.getTime() <= lastDay.getTime())
        .reduce((sum, t) => sum + t.sipAmount, 0);

      if (monthValue > 0 || cumulativeInvested > 0) {
        valueData.push({ date: lastDay, value: monthValue });
      }

      const returnPct = cumulativeInvested > 0 ? ((monthValue - cumulativeInvested) / cumulativeInvested) * 100 : null;

      validEntries.forEach((e) => {
        const ticker = e.ticker.trim().toUpperCase();
        const monthlyAmount = parseFloat(e.amount) || 0;
        const data = priceDataByTicker[ticker];
        if (!data || data.length === 0) return;

        const monthTransaction = transactions.find(
          (t) => t.ticker === ticker && 
                 t.userInvestDate === monthToStartDate(monthStr) &&
                 t.sipAmount === monthlyAmount
        );

        if (monthTransaction) {
          const monthEndPrice = getPriceAtDate(data, lastDay);
          const tickerOpenUnits = unitsByTicker[ticker] ?? 0;
          const monthInvestment = transactions
            .filter((t) => t.actualBuyDate && t.actualBuyDate.getTime() <= lastDay.getTime() && t.ticker === ticker)
            .reduce((sum, t) => sum + t.sipAmount, 0) / (monthlyAmount * months.length) * monthlyAmount;

          monthlyBreakdown.push({
            month: monthStr,
            ticker,
            price: monthTransaction.buyPrice,
            monthEndPrice,
            sipAmount: monthlyAmount,
            unitsBought: monthTransaction.units,
            accumulatedUnits: tickerOpenUnits,
            investment: monthlyAmount,
            cumulativeInvested,
            value: monthValue,
            returnPct,
          });
        }
      });
    });

    return {
      portfolio: p,
      summary,
      totalInvested,
      totalEndValue,
      totalXirr,
      valueData,
      monthlyBreakdown,
      transactions,
    };
  });

  const portfolioValueSeries = portfolioResults
    .filter((r) => r.valueData.length > 0)
    .map((r) => ({ name: r.portfolio.name, data: r.valueData }));

  const hasAnyChartData = portfolioValueSeries.length > 0;

  return (
    <Block position="relative">
      <LoadingOverlay active={loading} />

      <PageIntro title="SIP (stocks)">
        Monthly investments across a date range. Pick start and end month; each month invests the amount you set per ticker.
      </PageIntro>

      <PageCard>
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
            <LabelMedium marginBottom="0" marginTop="0">Start month</LabelMedium>
            <input
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              style={dateInputStyle}
            />
            <LabelMedium marginBottom="0" marginTop="0">End month</LabelMedium>
            <input
              type="month"
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              style={dateInputStyle}
            />
            <Button kind="primary" onClick={handlePlot} disabled={!hasValidEntries || isRangeInvalid}>
              Plot
            </Button>
            {isRangeInvalid && (
              <LabelMedium marginBottom="0" marginTop="0" overrides={{ Block: { style: ({ $theme }) => ({ color: $theme.colors.negative }) } }}>
                Start month must be before end month
              </LabelMedium>
            )}
          </Block>
      </PageCard>

      {hasAnyChartData && (
        <Block maxWidth="960px" margin="0 auto" width="100%">
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
                  columns={[
                    'Ticker',
                    'Investment ($)',
                    'User Investment Start Date',
                    'Actual Buy Start Date',
                    'Buy Price ($)',
                    'Units',
                    'User Selling End Date',
                    'Actual Sell End Date',
                    'Sell Price ($)',
                    'End Value ($)',
                    'Return (%)',
                    'XIRR (%)',
                  ]}
                  data={result.summary.map((s) => {
                    const returnColor = s.returnPct != null ? (s.returnPct >= 0 ? '#16a34a' : '#dc2626') : undefined;
                    const xirrColor = s.xirr != null ? (s.xirr >= 0 ? '#16a34a' : '#dc2626') : undefined;
                    const tickerTransactions = result.transactions.filter((t) => t.ticker === s.ticker).sort((a, b) => new Date(a.userInvestDate).getTime() - new Date(b.userInvestDate).getTime());
                    const firstTransaction = tickerTransactions[0];
                    const lastTransaction = tickerTransactions[tickerTransactions.length - 1];
                    const userInvestDate = firstTransaction ? firstTransaction.userInvestDate : 'N/A';
                    const actualBuyDate = firstTransaction ? formatDateForDisplay(firstTransaction.actualBuyDate) : 'N/A';
                    const buyPrice = firstTransaction ? firstTransaction.buyPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A';
                    const userSellingDate = lastTransaction ? endDateStr : 'N/A';
                    const actualSellDate = lastTransaction ? formatDateForDisplay(lastTransaction.actualSellDate) : 'N/A';
                    const sellPrice = lastTransaction ? lastTransaction.endPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A';
                    return [
                      s.ticker,
                      s.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                      userInvestDate,
                      actualBuyDate,
                      buyPrice,
                      s.units.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 }),
                      userSellingDate,
                      actualSellDate,
                      sellPrice,
                      s.endValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                      s.returnPct != null ? (
                        <span style={{ color: returnColor }}>
                          {(s.returnPct >= 0 ? '+' : '')}{s.returnPct.toFixed(1)}%
                        </span>
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
                    Total invested: <strong>${result.totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    {' · '}
                    Total value at end: <strong>${result.totalEndValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    {result.totalInvested > 0 && (
                      <span style={{ color: result.totalEndValue >= result.totalInvested ? '#16a34a' : '#dc2626' }}>
                        {' '}({(result.totalEndValue >= result.totalInvested ? '+' : '')}
                        {(((result.totalEndValue - result.totalInvested) / result.totalInvested) * 100).toFixed(2)}%)
                      </span>
                    )}
                    {result.totalXirr != null && (
                      <span style={{ color: result.totalXirr >= 0 ? '#16a34a' : '#dc2626', marginLeft: '8px' }}>
                        · XIRR: {(result.totalXirr * 100).toFixed(2)}%
                      </span>
                    )}
                  </ParagraphMedium>
                </Block>
              </Block>
            ) : null
          )}

          {portfolioValueSeries.length > 0 && (
            <>
              <StockPortfolioValueChart key="sip-portfolio-value" series={portfolioValueSeries} />
              <StockPortfolioValueNormalizedChart key="sip-portfolio-normalized" series={portfolioValueSeries} />
            </>
          )}

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
                Per ticker: Price ($) = on SIP date (1st of month); Month-end price ($) = on last calendar day of month (each ticker’s contribution to Value is accumulated units × this price). Value ($) is the portfolio total (sum across tickers). Investment/Cumulative/Return are portfolio totals.
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

          {portfolioResults.filter((r) => r.transactions.length > 0).map((result) => (
            <Block
              key={`txn-details-${result.portfolio.id}`}
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
                {result.portfolio.name} – Transaction Details
              </LabelMedium>
              <ParagraphMedium marginTop="0" marginBottom="scale300" color="contentSecondary" $style={{ fontSize: '13px' }}>
                Individual transaction details: each monthly investment shown with its buy date and corresponding prices.
              </ParagraphMedium>
              <Table
                columns={[
                  'Ticker',
                  'User Investment Start Date',
                  'Actual Buy Start Date',
                  'Buy Price ($)',
                  'SIP Amount ($)',
                  'Units',
                  'End Value ($)',
                  'Return (%)',
                ]}
                data={result.transactions.map((tx) => {
                  const returnColor = tx.returnPercent >= 0 ? '#16a34a' : '#dc2626';
                  return [
                    tx.ticker,
                    tx.userInvestDate,
                    formatDateForDisplay(tx.actualBuyDate),
                    tx.buyPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    tx.sipAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    tx.units.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 }),
                    tx.endValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    <span style={{ color: returnColor }}>
                      {(tx.returnPercent >= 0 ? '+' : '')}{tx.returnPercent.toFixed(2)}%
                    </span>,
                  ];
                })}
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
