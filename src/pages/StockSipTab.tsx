import React, { useState } from 'react';
import xirr from 'xirr';
import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { Input } from 'baseui/input';
import { LabelMedium, ParagraphMedium } from 'baseui/typography';
import { Table } from 'baseui/table-semantic';
import { LoadingOverlay } from '../components/common/LoadingOverlay';
import { fillMissingNavDates } from '../utils/data/fillMissingNavDates';
import { yahooFinanceService } from '../services/yahooFinanceService';
import { StockPortfolioValueChart } from '../components/charts/StockPortfolioValueChart';
import { StockPortfolioValueNormalizedChart } from '../components/charts/StockPortfolioValueNormalizedChart';
import { mfapiMutualFund } from '../types/mfapiMutualFund';

function getPriceAtDate(data: Array<{ date: Date; nav: number }>, targetDate: Date): number {
  const t = targetDate.getTime();
  let last = data[0];
  for (const p of data) {
    if (p.date.getTime() <= t) last = p;
    else break;
  }
  return last.nav;
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

interface StockSipTabProps {
  funds: mfapiMutualFund[];
}

const dateInputStyle = {
  padding: '8px 12px',
  borderRadius: '4px',
  border: '1px solid #e5e7eb',
  fontSize: '14px',
  fontFamily: 'inherit' as const,
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

export const StockSipTab: React.FC<StockSipTabProps> = () => {
  const [portfolios, setPortfolios] = useState<PortfolioDef[]>(() =>
    INITIAL_PORTFOLIOS.map((p) => ({
      ...p,
      entries: p.entries.map((e) => ({ ...e, id: crypto.randomUUID?.() ?? String(Date.now() + Math.random()) })),
    }))
  );
  const [priceDataByTicker, setPriceDataByTicker] = useState<
    Record<string, Array<{ date: Date; nav: number }>>
  >({});
  const [loading, setLoading] = useState(false);
  const [startMonth, setStartMonth] = useState<string>(defaultStartMonth);
  const [endMonth, setEndMonth] = useState<string>(defaultEndMonth);

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
            byTicker[realTickers[i]] = fillMissingNavDates(result.value);
          }
        });
      }

      syntheticTickers.forEach(({ ticker, parsed }) => {
        byTicker[ticker] = generateSyntheticPriceData(startDateStr, endDateStr, parsed.rate);
      });

      setPriceDataByTicker(byTicker);
    } catch (error) {
      console.error('Error fetching stock prices:', error);
    } finally {
      setLoading(false);
    }
  };

  const months = getMonthsBetween(startMonth, endMonth);

  const portfolioResults = portfolios.map((p) => {
    const validEntries = p.entries.filter((e) => e.ticker.trim() && parseFloat(e.amount) > 0);
    const sipTransactions: Array<{ date: Date; amount: number }> = [];
    const unitsByTicker: Record<string, number> = {};
    let totalInvested = 0;

    validEntries.forEach((e) => {
      const ticker = e.ticker.trim().toUpperCase();
      const monthlyAmount = parseFloat(e.amount) || 0;
      unitsByTicker[ticker] = 0;

      months.forEach((monthStr) => {
        const investDate = new Date(monthStr + '-01T12:00:00Z');
        const data = priceDataByTicker[ticker];
        if (!data || data.length === 0) return;

        const price = getPriceAtDate(data, investDate);
        if (price > 0 && monthlyAmount > 0) {
          unitsByTicker[ticker] += monthlyAmount / price;
          totalInvested += monthlyAmount;
          sipTransactions.push({ date: investDate, amount: -monthlyAmount });
        }
      });
    });

    const endDate = new Date(endDateStr + 'T23:59:59Z');
    let totalEndValue = 0;
    const summary = validEntries
      .map((e) => {
        const ticker = e.ticker.trim().toUpperCase();
        const data = priceDataByTicker[ticker];
        const monthlyAmount = parseFloat(e.amount) || 0;
        const units = unitsByTicker[ticker] ?? 0;
        const endPrice = data?.length ? getPriceAtDate(data, endDate) : 0;
        const endValue = units * endPrice;
        totalEndValue += endValue;
        const invested = monthlyAmount * months.length;
        const returnPct = invested > 0 ? ((endValue - invested) / invested) * 100 : null;
        return { ticker, amount: invested, monthlyAmount, units, endValue, returnPct };
      })
      .filter((s) => s.units > 0);

    sipTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    const uniqueByDate = new Map<string, number>();
    sipTransactions.forEach((t) => {
      const key = t.date.toISOString().slice(0, 10);
      uniqueByDate.set(key, (uniqueByDate.get(key) ?? 0) + t.amount);
    });
    const xirrTransactions = [
      ...Array.from(uniqueByDate.entries()).map(([d, amt]) => ({ amount: amt, when: new Date(d) })),
      { amount: totalEndValue, when: endDate },
    ].sort((a, b) => a.when.getTime() - b.when.getTime());

    let totalXirr: number | null = null;
    try {
      totalXirr = xirr(xirrTransactions);
    } catch {
      // ignore
    }

    // Build valueData with cumulative units per month (correct SIP simulation)
    const valueData: Array<{ date: Date; value: number }> = [];
    const monthlyBreakdown: Array<{
      month: string;
      ticker: string;
      price: number;
      sipAmount: number;
      unitsBought: number;
      accumulatedUnits: number;
      investment: number;
      cumulativeInvested: number;
      value: number;
      returnPct: number | null;
    }> = [];
    let cumulativeUnitsByTicker: Record<string, number> = {};
    let cumulativeInvested = 0;

    months.forEach((monthStr) => {
      const monthEndDate = new Date(monthStr + '-01T12:00:00Z');
      const lastDay = new Date(monthEndDate.getFullYear(), monthEndDate.getMonth() + 1, 0);
      const investDate = new Date(monthStr + '-01T12:00:00Z');

      let monthInvestment = 0;
      validEntries.forEach((e) => {
        const ticker = e.ticker.trim().toUpperCase();
        const monthlyAmount = parseFloat(e.amount) || 0;
        const data = priceDataByTicker[ticker];
        if (!data || data.length === 0) return;
        const price = getPriceAtDate(data, investDate);
        if (price > 0 && monthlyAmount > 0) {
          const unitsBought = monthlyAmount / price;
          cumulativeUnitsByTicker[ticker] = (cumulativeUnitsByTicker[ticker] ?? 0) + unitsBought;
          monthInvestment += monthlyAmount;
        }
      });
      cumulativeInvested += monthInvestment;

      const value = Object.entries(cumulativeUnitsByTicker).reduce((sum, [ticker, units]) => {
        const data = priceDataByTicker[ticker];
        if (!data) return sum;
        return sum + units * getPriceAtDate(data, lastDay);
      }, 0);

      valueData.push({ date: lastDay, value });
      const returnPct = cumulativeInvested > 0 ? ((value - cumulativeInvested) / cumulativeInvested) * 100 : null;

      validEntries.forEach((e) => {
        const ticker = e.ticker.trim().toUpperCase();
        const monthlyAmount = parseFloat(e.amount) || 0;
        const data = priceDataByTicker[ticker];
        if (!data || data.length === 0) return;
        const price = getPriceAtDate(data, investDate);
        const unitsBought = price > 0 && monthlyAmount > 0 ? monthlyAmount / price : 0;
        const accumulatedUnits = cumulativeUnitsByTicker[ticker] ?? 0;
        monthlyBreakdown.push({
          month: monthStr,
          ticker,
          price,
          sipAmount: monthlyAmount,
          unitsBought,
          accumulatedUnits,
          investment: monthInvestment,
          cumulativeInvested,
          value,
          returnPct,
        });
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
    };
  });

  const portfolioValueSeries = portfolioResults
    .filter((r) => r.valueData.length > 0)
    .map((r) => ({ name: r.portfolio.name, data: r.valueData }));

  const hasAnyChartData = portfolioValueSeries.length > 0;

  return (
    <Block position="relative">
      <LoadingOverlay active={loading} />

      <Block maxWidth="900px" margin="0 auto" marginBottom="scale400" paddingTop="0" display="flex" justifyContent="center">
        <ParagraphMedium color="contentTertiary" marginTop="0" marginBottom="0">
          Simulate SIP (monthly investment). Select start and end month. Each month you invest the amount per ticker.
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
              Plot
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
                  columns={['Ticker', 'Invested ($)', 'Units', 'End Value ($)', 'Return (%)']}
                  data={result.summary.map((s) => [
                    s.ticker,
                    s.amount.toLocaleString('en-US', { minimumFractionDigits: 2 }),
                    s.units.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 }),
                    s.endValue.toLocaleString('en-US', { minimumFractionDigits: 2 }),
                    s.returnPct != null ? (
                      <span style={{ color: s.returnPct >= 0 ? '#16a34a' : '#dc2626' }}>
                        {(s.returnPct >= 0 ? '+' : '')}{s.returnPct.toFixed(1)}%
                      </span>
                    ) : (
                      '—'
                    ),
                  ])}
                  divider="horizontal"
                  size="compact"
                />
                <Block marginTop="scale400" paddingTop="scale300" $style={{ borderTop: '1px solid #e5e7eb' }}>
                  <ParagraphMedium marginTop="0" marginBottom="0">
                    Total invested: <strong>${result.totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                    {' · '}
                    Total value at end: <strong>${result.totalEndValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                    {result.totalInvested > 0 && (
                      <span style={{ color: result.totalEndValue >= result.totalInvested ? '#16a34a' : '#dc2626' }}>
                        {' '}({(result.totalEndValue >= result.totalInvested ? '+' : '')}
                        {(((result.totalEndValue - result.totalInvested) / result.totalInvested) * 100).toFixed(1)}%)
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
                Per ticker: Price = stock price on SIP date; Units Bought = SIP Amount / Price; Accumulated = total units held; Investment/Cumulative/Value/Return are portfolio totals.
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
                  'Value ($)',
                  'Return (%)',
                ]}
                data={result.monthlyBreakdown.map((row) => [
                  row.month,
                  row.ticker,
                  row.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
                  row.sipAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }),
                  row.unitsBought.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 }),
                  row.accumulatedUnits.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 }),
                  row.investment.toLocaleString('en-US', { minimumFractionDigits: 2 }),
                  row.cumulativeInvested.toLocaleString('en-US', { minimumFractionDigits: 2 }),
                  row.value.toLocaleString('en-US', { minimumFractionDigits: 2 }),
                  row.returnPct != null ? (
                    <span style={{ color: row.returnPct >= 0 ? '#16a34a' : '#dc2626' }}>
                      {(row.returnPct >= 0 ? '+' : '')}{row.returnPct.toFixed(1)}%
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
};
