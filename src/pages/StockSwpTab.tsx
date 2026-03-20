import React, { useState } from 'react';
import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { Input } from 'baseui/input';
import { LabelMedium, ParagraphMedium } from 'baseui/typography';
import { Table } from 'baseui/table-semantic';
import { Select } from 'baseui/select';
import { LoadingOverlay } from '../components/common/LoadingOverlay';
import { fillMissingNavDates } from '../utils/data/fillMissingNavDates';
import { yahooFinanceService } from '../services/yahooFinanceService';
import { StockPortfolioValueChart } from '../components/charts/StockPortfolioValueChart';
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

type WithdrawalType = 'fixed' | 'fixed_growth' | 'percent';

interface WithdrawalStrategy {
  type: WithdrawalType;
  amount: string;      // $ for fixed/fixed_growth, % for percent
  growthPct: string;   // monthly growth % for fixed_growth
}

interface CorpusEntry {
  id: string;
  ticker: string;
  corpus: string;
}

const STRATEGY_OPTIONS = [
  { label: 'Fixed $/month', id: 'fixed' as WithdrawalType },
  { label: 'Fixed $ + growth %/month', id: 'fixed_growth' as WithdrawalType },
  { label: '% of portfolio/month', id: 'percent' as WithdrawalType },
];

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

interface StockSwpTabProps {
  funds: mfapiMutualFund[];
}

function StrategySection({
  name,
  strategy,
  onStrategyChange,
  borderColor,
}: {
  name: string;
  strategy: WithdrawalStrategy;
  onStrategyChange: (s: WithdrawalStrategy) => void;
  borderColor: string;
}) {
  const typeValue = STRATEGY_OPTIONS.find((o) => o.id === strategy.type)
    ? [{ label: STRATEGY_OPTIONS.find((o) => o.id === strategy.type)!.label, id: strategy.type }]
    : [];
  return (
    <Block
      padding="scale500"
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
        {name}
      </LabelMedium>
      <Block display="flex" flexDirection="column" gridGap="scale300">
        <Block>
          <LabelMedium marginBottom="scale200" $style={{ fontSize: '12px' }}>Withdrawal type</LabelMedium>
          <Select
            options={STRATEGY_OPTIONS}
            value={typeValue}
            onChange={({ value }) => value[0] && onStrategyChange({ ...strategy, type: value[0].id as WithdrawalType })}
            placeholder="Select"
            clearable={false}
            searchable={false}
            overrides={{ ControlContainer: { style: { minWidth: '200px' } } }}
          />
        </Block>
        {(strategy.type === 'fixed' || strategy.type === 'fixed_growth') && (
          <Block>
            <LabelMedium marginBottom="scale200" $style={{ fontSize: '12px' }}>
              Amount ($/month) at start
            </LabelMedium>
            <Input
              value={strategy.amount}
              onChange={(e) => onStrategyChange({ ...strategy, amount: (e.target as HTMLInputElement).value.replace(/[^0-9.]/g, '') })}
              placeholder="e.g. 1000"
              size="compact"
              overrides={{ Root: { style: { width: '140px' } } }}
            />
          </Block>
        )}
        {strategy.type === 'fixed_growth' && (
          <Block>
            <LabelMedium marginBottom="scale200" $style={{ fontSize: '12px' }}>
              Monthly growth (%)
            </LabelMedium>
            <Input
              value={strategy.growthPct}
              onChange={(e) => onStrategyChange({ ...strategy, growthPct: (e.target as HTMLInputElement).value.replace(/[^0-9.]/g, '') })}
              placeholder="e.g. 0.5"
              size="compact"
              overrides={{ Root: { style: { width: '100px' } } }}
            />
          </Block>
        )}
        {strategy.type === 'percent' && (
          <Block>
            <LabelMedium marginBottom="scale200" $style={{ fontSize: '12px' }}>
              Withdraw (% of portfolio/month)
            </LabelMedium>
            <Input
              value={strategy.amount}
              onChange={(e) => onStrategyChange({ ...strategy, amount: (e.target as HTMLInputElement).value.replace(/[^0-9.]/g, '') })}
              placeholder="e.g. 1"
              size="compact"
              overrides={{ Root: { style: { width: '100px' } } }}
            />
          </Block>
        )}
      </Block>
    </Block>
  );
}

export const StockSwpTab: React.FC<StockSwpTabProps> = () => {
  const [corpusEntries, setCorpusEntries] = useState<CorpusEntry[]>([
    { id: crypto.randomUUID?.() ?? '1', ticker: '', corpus: '' },
  ]);
  const [startMonth, setStartMonth] = useState<string>(defaultStartMonth);
  const [endMonth, setEndMonth] = useState<string>(defaultEndMonth);
  const [strategyA, setStrategyA] = useState<WithdrawalStrategy>({
    type: 'fixed',
    amount: '1000',
    growthPct: '0.5',
  });
  const [strategyB, setStrategyB] = useState<WithdrawalStrategy>({
    type: 'percent',
    amount: '1',
    growthPct: '0',
  });
  const [priceDataByTicker, setPriceDataByTicker] = useState<
    Record<string, Array<{ date: Date; nav: number }>>
  >({});
  const [loading, setLoading] = useState(false);
  const [swpResults, setSwpResults] = useState<{
    strategyA: { valueData: Array<{ date: Date; value: number }>; withdrawalData: Array<{ date: Date; value: number }> };
    strategyB: { valueData: Array<{ date: Date; value: number }>; withdrawalData: Array<{ date: Date; value: number }> };
  } | null>(null);

  const validEntries = corpusEntries.filter((e) => e.ticker.trim() && parseFloat(e.corpus) > 0);
  const uniqueTickers = [...new Set(validEntries.map((e) => e.ticker.trim().toUpperCase()))];
  const totalCorpus = validEntries.reduce((s, e) => s + (parseFloat(e.corpus) || 0), 0);
  const isRangeInvalid = startMonth > endMonth;

  const startDateStr = monthToStartDate(startMonth);
  const endDateStr = monthToEndDate(endMonth);

  const handleAddCorpusRow = () => {
    setCorpusEntries((prev) => [...prev, { id: crypto.randomUUID?.() ?? String(Date.now()), ticker: '', corpus: '' }]);
  };

  const handleRemoveCorpusRow = (id: string) => {
    if (corpusEntries.length <= 1) return;
    setCorpusEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleUpdateCorpus = (id: string, field: 'ticker' | 'corpus', value: string) => {
    setCorpusEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              [field]:
                field === 'ticker'
                  ? (value as string).toUpperCase()
                  : (value as string).replace(/[^0-9.]/g, ''),
            }
          : e
      )
    );
  };

  function runSwp(
    strategy: WithdrawalStrategy,
    unitsByTicker: Record<string, number>,
    months: string[],
    priceData: Record<string, Array<{ date: Date; nav: number }>>
  ): { valueData: Array<{ date: Date; value: number }>; withdrawalData: Array<{ date: Date; value: number }> } {
    const valueData: Array<{ date: Date; value: number }> = [];
    const withdrawalData: Array<{ date: Date; value: number }> = [];

    const firstMonthStart = new Date(months[0] + '-01T12:00:00Z');
    let initialValue = 0;
    Object.entries(unitsByTicker).forEach(([ticker, units]) => {
      const data = priceData[ticker];
      if (data) initialValue += units * getPriceAtDate(data, firstMonthStart);
    });
    valueData.push({ date: firstMonthStart, value: initialValue });
    withdrawalData.push({ date: firstMonthStart, value: 0 });

    let u: Record<string, number> = {};
    Object.entries(unitsByTicker).forEach(([k, v]) => {
      u[k] = v;
    });
    const baseAmount = parseFloat(strategy.amount) || 0;
    const growthRate = (parseFloat(strategy.growthPct) || 0) / 100;
    const percentRate = (parseFloat(strategy.amount) || 0) / 100;

    months.forEach((monthStr, monthIndex) => {
      const monthEndDate = new Date(monthStr + '-01T12:00:00Z');
      const lastDay = new Date(monthEndDate.getFullYear(), monthEndDate.getMonth() + 1, 0);

      let portfolioValue = 0;
      Object.entries(u).forEach(([ticker, units]) => {
        const data = priceData[ticker];
        if (data) portfolioValue += units * getPriceAtDate(data, lastDay);
      });

      let withdrawAmount = 0;
      if (portfolioValue > 0) {
        if (strategy.type === 'fixed') {
          withdrawAmount = Math.min(baseAmount, portfolioValue);
        } else if (strategy.type === 'fixed_growth') {
          const thisMonthAmount = baseAmount * Math.pow(1 + growthRate, monthIndex);
          withdrawAmount = Math.min(thisMonthAmount, portfolioValue);
        } else {
          withdrawAmount = portfolioValue * percentRate;
        }
      }

      if (withdrawAmount > 0 && portfolioValue > 0) {
        const ratio = withdrawAmount / portfolioValue;
        Object.keys(u).forEach((ticker) => {
          u[ticker] = u[ticker] * (1 - ratio);
        });
      }

      valueData.push({ date: lastDay, value: portfolioValue - withdrawAmount });
      withdrawalData.push({ date: lastDay, value: withdrawAmount });
    });

    return { valueData, withdrawalData };
  }

  const handleSimulate = async () => {
    if (validEntries.length === 0 || isRangeInvalid) return;

    setLoading(true);
    setPriceDataByTicker({});
    setSwpResults(null);

    try {
      const realTickers = uniqueTickers.filter((t) => !parseSyntheticTicker(t));
      const syntheticTickers = uniqueTickers
        .map((t) => ({ ticker: t, parsed: parseSyntheticTicker(t) }))
        .filter((x): x is { ticker: string; parsed: { rate: number } } => x.parsed != null);

      const byTicker: Record<string, Array<{ date: Date; nav: number }>> = {};

      if (realTickers.length > 0) {
        const results = await Promise.allSettled(
          realTickers.map((t) =>
            yahooFinanceService.fetchStockData(t, { startDate: startDateStr, endDate: endDateStr })
          )
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

      const months = getMonthsBetween(startMonth, endMonth);
      const investDate = new Date(months[0] + '-01T12:00:00Z');

      const unitsByTicker: Record<string, number> = {};
      validEntries.forEach((e) => {
        const ticker = e.ticker.trim().toUpperCase();
        const corpus = parseFloat(e.corpus) || 0;
        const data = byTicker[ticker];
        if (!data || data.length === 0) return;
        const price = getPriceAtDate(data, investDate);
        if (price > 0) unitsByTicker[ticker] = corpus / price;
      });

      const resultA = runSwp(strategyA, { ...unitsByTicker }, months, byTicker);
      const resultB = runSwp(strategyB, { ...unitsByTicker }, months, byTicker);

      setSwpResults({
        strategyA: resultA,
        strategyB: resultB,
      });
    } catch (error) {
      console.error('Error fetching stock prices:', error);
    } finally {
      setLoading(false);
    }
  };

  const portfolioValueSeries =
    swpResults != null
      ? [
          { name: 'Strategy A', data: swpResults.strategyA.valueData },
          { name: 'Strategy B', data: swpResults.strategyB.valueData },
        ].filter((s) => s.data.length > 0)
      : [];

  const withdrawalSeries =
    swpResults != null
      ? [
          { name: 'Strategy A', data: swpResults.strategyA.withdrawalData },
          { name: 'Strategy B', data: swpResults.strategyB.withdrawalData },
        ].filter((s) => s.data.length > 0)
      : [];

  const hasResults = swpResults != null && portfolioValueSeries.length > 0;

  return (
    <Block position="relative">
      <LoadingOverlay active={loading} />

      <Block maxWidth="900px" margin="0 auto" marginBottom="scale400">
        <ParagraphMedium color="contentTertiary" marginTop="0" marginBottom="0">
          Simulate SWP (Systematic Withdrawal Plan). Enter your holdings (ticker + corpus $). Choose two withdrawal strategies to compare.
        </ParagraphMedium>
      </Block>

      <Block maxWidth="900px" margin="0 auto">
        <Block
          padding="scale700"
          marginBottom="scale600"
          backgroundColor="backgroundPrimary"
          overrides={{
            Block: {
              style: ({ $theme }) => ({
                borderLeft: '4px solid #10b981',
                borderRadius: $theme.borders.radius200,
              }),
            },
          }}
        >
          <LabelMedium marginBottom="scale300" $style={{ fontWeight: 600 }}>
            Portfolio (shared)
          </LabelMedium>
          <Block
            padding="scale400"
            marginBottom="scale400"
            $style={{ backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}
          >
            {corpusEntries.map((e) => (
              <Block key={e.id} display="flex" alignItems="center" gridGap="scale300" marginBottom="scale300" $style={{ flexWrap: 'wrap' }}>
                <Input
                  value={e.ticker}
                  onChange={(ev) => handleUpdateCorpus(e.id, 'ticker', (ev.target as HTMLInputElement).value)}
                  placeholder="Ticker (e.g. VOO, ~12)"
                  size="compact"
                  overrides={{ Root: { style: { width: '140px' } } }}
                />
                <LabelMedium marginBottom="0">Corpus ($)</LabelMedium>
                <Input
                  value={e.corpus}
                  onChange={(ev) => handleUpdateCorpus(e.id, 'corpus', (ev.target as HTMLInputElement).value.replace(/[^0-9.]/g, ''))}
                  placeholder="e.g. 100000"
                  size="compact"
                  overrides={{ Root: { style: { width: '120px' } } }}
                />
                <Button kind="tertiary" size="mini" onClick={() => handleRemoveCorpusRow(e.id)} disabled={corpusEntries.length <= 1}>
                  Remove
                </Button>
              </Block>
            ))}
            <Button kind="secondary" size="compact" onClick={handleAddCorpusRow}>
              + Add ticker
            </Button>
          </Block>

          <Block display="flex" alignItems="center" gridGap="scale400" $style={{ flexWrap: 'wrap' }}>
            <Block>
              <LabelMedium marginBottom="scale200" $style={{ fontSize: '12px' }}>Start month</LabelMedium>
              <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} style={dateInputStyle} />
            </Block>
            <Block>
              <LabelMedium marginBottom="scale200" $style={{ fontSize: '12px' }}>End month</LabelMedium>
              <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} style={dateInputStyle} />
            </Block>
            {validEntries.length > 0 && totalCorpus > 0 && (
              <ParagraphMedium marginTop="scale500" marginBottom="0">
                Total corpus: <strong>${totalCorpus.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
              </ParagraphMedium>
            )}
          </Block>

          <Block display="flex" gridGap="scale600" marginTop="scale600" $style={{ flexWrap: 'wrap' }}>
            <StrategySection
              name="Strategy A"
              strategy={strategyA}
              onStrategyChange={setStrategyA}
              borderColor="#6366f1"
            />
            <StrategySection
              name="Strategy B"
              strategy={strategyB}
              onStrategyChange={setStrategyB}
              borderColor="#ec4899"
            />
          </Block>

          <Block marginTop="scale600">
            <Button kind="primary" onClick={handleSimulate} disabled={validEntries.length === 0 || isRangeInvalid}>
              Simulate
            </Button>
            {isRangeInvalid && (
              <LabelMedium marginLeft="scale400" color="negative">Start month must be before end month</LabelMedium>
            )}
          </Block>
        </Block>
      </Block>

      {hasResults && swpResults != null && (
        <Block maxWidth="90%" margin="0 auto">
          <StockPortfolioValueChart
            key="swp-portfolio-value"
            series={portfolioValueSeries}
          />
          <Block marginTop="scale700">
            <StockPortfolioValueChart
              key="swp-withdrawal"
              series={withdrawalSeries}
              title="Withdrawal per Month (Compare)"
              yAxisTitle="Withdrawal ($)"
            />
          </Block>

          <Block
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
              SWP Withdrawal Breakdown
            </LabelMedium>
            <ParagraphMedium marginTop="0" marginBottom="scale300" color="contentSecondary" $style={{ fontSize: '13px' }}>
              Month-by-month: Portfolio Value = value at month-end (after withdrawal); Withdrawal = amount withdrawn that month; matches chart data above.
            </ParagraphMedium>
            <Table
              columns={[
                'Month',
                'Strategy A Value ($)',
                'Strategy A Withdrawal ($)',
                'Strategy A Cumulative ($)',
                'Strategy B Value ($)',
                'Strategy B Withdrawal ($)',
                'Strategy B Cumulative ($)',
              ]}
              data={(() => {
                const va = swpResults.strategyA.valueData;
                const wa = swpResults.strategyA.withdrawalData;
                const vb = swpResults.strategyB.valueData;
                const wb = swpResults.strategyB.withdrawalData;
                const len = Math.min(va.length, wa.length, vb.length, wb.length);
                const rows: React.ReactNode[][] = [];
                let cumA = 0;
                let cumB = 0;
                for (let i = 0; i < len; i++) {
                  const d = va[i]?.date ?? vb[i]?.date;
                  const monthStr = d
                    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                    : '—';
                  const wai = wa[i]?.value ?? 0;
                  const wbi = wb[i]?.value ?? 0;
                  cumA += wai;
                  cumB += wbi;
                  rows.push([
                    monthStr,
                    va[i]?.value != null ? va[i].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—',
                    wa[i]?.value != null ? wa[i].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00',
                    cumA.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    vb[i]?.value != null ? vb[i].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—',
                    wb[i]?.value != null ? wb[i].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00',
                    cumB.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  ]);
                }
                return rows;
              })()}
              divider="horizontal"
              size="compact"
            />
          </Block>
        </Block>
      )}
    </Block>
  );
}
