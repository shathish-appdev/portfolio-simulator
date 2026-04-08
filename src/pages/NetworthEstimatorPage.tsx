import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { Input } from 'baseui/input';
import { LabelMedium, ParagraphMedium } from 'baseui/typography';
import React, { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { NetWorthStackedAreaChart } from '../components/charts/NetWorthStackedAreaChart';
import { StockPriceChart } from '../components/charts/StockPriceChart';
import type { StockSeries } from '../components/charts/StockPriceChart';
import { LoadingOverlay } from '../components/common/LoadingOverlay';
import { PageCard, PageIntro } from '../components/common/PageChrome';
import { yahooFinanceService } from '../services/yahooFinanceService';
import { splitTickerAmountSegment } from '../utils/browser/tickerAmountUrl';
import {
  USD_CASH_TICKER,
  buildNetWorthSeries,
  buildPerTickerValueSeries,
  isUsdCashTicker,
  mergeHoldingsByTicker,
  normalizePerTickerSeriesTo100,
} from '../utils/data/netWorthSeries';

type HoldingRow = { id: string; ticker: string; units: string };

function newRowId(): string {
  return crypto.randomUUID?.() ?? String(Date.now() + Math.random());
}

function defaultStartDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function defaultEndDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseHoldingsParam(h: string | null): HoldingRow[] {
  if (!h?.trim()) return [{ id: newRowId(), ticker: '', units: '' }];
  const rows = h.split(',').map((part) => {
    const { ticker, amount } = splitTickerAmountSegment(part);
    return { id: newRowId(), ticker: ticker.toUpperCase(), units: amount };
  });
  return rows.filter((r) => r.ticker || r.units).length ? rows : [{ id: newRowId(), ticker: '', units: '' }];
}

function serializeHoldings(rows: HoldingRow[]): string {
  return rows
    .map((r) => {
      const t = r.ticker.trim().toUpperCase();
      const u = r.units.trim();
      if (!t && !u) return '';
      return `${t}:${u}`;
    })
    .filter(Boolean)
    .join(',');
}

export function NetworthEstimatorPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<HoldingRow[]>(() => parseHoldingsParam(searchParams.get('h')));
  const [startDate, setStartDate] = useState(() => searchParams.get('start') ?? defaultStartDate());
  const [endDate, setEndDate] = useState(() => searchParams.get('end') ?? defaultEndDate());
  const [series, setSeries] = useState<Array<{ date: Date; nav: number }>>([]);
  const [byTickerSeries, setByTickerSeries] = useState<StockSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDateInvalid = new Date(startDate) > new Date(endDate);

  const holdingsParsed = useMemo(() => {
    const out: Array<{ ticker: string; units: number }> = [];
    for (const r of rows) {
      const t = r.ticker.trim().toUpperCase();
      const u = parseFloat(r.units.replace(/,/g, ''));
      if (!t || Number.isNaN(u) || u <= 0) continue;
      out.push({ ticker: t, units: u });
    }
    return out;
  }, [rows]);

  const handleFetch = useCallback(async () => {
    setError(null);
    if (holdingsParsed.length === 0) {
      setError(
        `Add at least one row with a ticker and a positive amount. Use ${USD_CASH_TICKER} for US dollars (units = dollars).`
      );
      return;
    }
    if (isDateInvalid) {
      setError('Start date must be before or equal to end date.');
      return;
    }

    setLoading(true);
    setSeries([]);
    setByTickerSeries([]);

    try {
      const hParam = serializeHoldings(rows);
      const next = new URLSearchParams();
      next.set('start', startDate);
      next.set('end', endDate);
      if (hParam) next.set('h', hParam);
      setSearchParams(next);

      const merged = mergeHoldingsByTicker(holdingsParsed);
      const perTicker = new Map<string, Array<{ date: Date; nav: number }>>();
      await Promise.all(
        merged
          .filter((h) => !isUsdCashTicker(h.ticker))
          .map(async (h) => {
            const data = await yahooFinanceService.fetchStockData(h.ticker, { startDate, endDate });
            perTicker.set(h.ticker, data);
          })
      );

      const start = new Date(`${startDate}T00:00:00Z`);
      const end = new Date(`${endDate}T23:59:59Z`);
      const nw = buildNetWorthSeries(merged, perTicker, start, end);
      const perHolding = buildPerTickerValueSeries(merged, perTicker, start, end);

      if (nw.length < 2) {
        setError('Not enough overlapping price history for your holdings in this date range.');
        return;
      }
      setSeries(nw);
      setByTickerSeries(perHolding as StockSeries[]);
    } catch (err) {
      setError((err as Error).message || 'Failed to load prices.');
    } finally {
      setLoading(false);
    }
  }, [holdingsParsed, rows, startDate, endDate, isDateInvalid, setSearchParams]);

  const dateInputStyle = {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '14px',
    fontFamily: 'inherit' as const,
    backgroundColor: '#fff',
  };

  const updateRow = (id: string, patch: Partial<Pick<HoldingRow, 'ticker' | 'units'>>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, { id: newRowId(), ticker: '', units: '' }]);
  const removeRow = (id: string) => setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));

  const showBreakdownCharts = byTickerSeries.length > 0 && byTickerSeries.some((s) => s.data.length >= 2);

  const normalizedByTickerSeries = useMemo(
    () => normalizePerTickerSeriesTo100(byTickerSeries),
    [byTickerSeries]
  );

  return (
    <Block position="relative">
      <LoadingOverlay active={loading} />
      <PageIntro title="Net worth estimator">
        Enter stock tickers and share counts (decimals allowed). Use the synthetic ticker <strong>{USD_CASH_TICKER}</strong> for US
        dollar cash—units are dollars (e.g. 5000 = $5,000). Choose a date range, then load charts: total net worth, each holding’s
        value over time, a stacked view of contributions, and a relative-performance chart with each line indexed to 100 on the first
        date.
      </PageIntro>

      <PageCard>
        <Block marginBottom="scale500">
          <LabelMedium marginBottom="scale200">Holdings</LabelMedium>
          {rows.map((r) => (
            <Block key={r.id} display="flex" flexWrap="wrap" gridGap="scale300" marginBottom="scale300" alignItems="flex-end">
              <Block flex="1" minWidth="140px">
                <LabelMedium>Ticker</LabelMedium>
                <Input
                  value={r.ticker}
                  onChange={(e) => updateRow(r.id, { ticker: (e.target as HTMLInputElement).value.toUpperCase() })}
                  placeholder={`AAPL or ${USD_CASH_TICKER}`}
                  size="compact"
                />
              </Block>
              <Block flex="1" minWidth="120px">
                <LabelMedium>Units / $</LabelMedium>
                <Input
                  value={r.units}
                  onChange={(e) => updateRow(r.id, { units: (e.target as HTMLInputElement).value })}
                  placeholder="10.5"
                  size="compact"
                />
              </Block>
              <Button kind="secondary" size="compact" onClick={() => removeRow(r.id)} disabled={rows.length <= 1}>
                Remove
              </Button>
            </Block>
          ))}
          <Button kind="secondary" size="compact" onClick={addRow}>
            Add holding
          </Button>
        </Block>

        <Block display="flex" flexWrap="wrap" gridGap="scale500" marginBottom="scale400" alignItems="flex-end">
          <Block display="flex" flexDirection="column" gridGap="scale100">
            <LabelMedium>Start date</LabelMedium>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={dateInputStyle} />
          </Block>
          <Block display="flex" flexDirection="column" gridGap="scale100">
            <LabelMedium>End date</LabelMedium>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={dateInputStyle} />
          </Block>
          <Button kind="primary" onClick={() => void handleFetch()} isLoading={loading} disabled={isDateInvalid || loading}>
            Load chart
          </Button>
        </Block>

        {error && (
          <ParagraphMedium marginTop="scale200" color="contentNegative">
            {error}
          </ParagraphMedium>
        )}

        {series.length >= 2 && (
          <>
            <StockPriceChart
              data={series}
              ticker="Net worth"
              chartTitle="Portfolio net worth"
              valueAxisTitle="Net worth (USD)"
              tooltipValueLabel="Net worth"
            />

            {showBreakdownCharts && (
              <>
                <StockPriceChart
                  series={byTickerSeries}
                  multiChartTitle="Value by holding (USD)"
                  multiValueAxisTitle="Value (USD)"
                />
                <NetWorthStackedAreaChart series={byTickerSeries} />
                <StockPriceChart
                  series={normalizedByTickerSeries}
                  multiChartTitle="Relative performance (indexed to 100 at first date)"
                  multiValueAxisTitle="Index (start = 100)"
                />
              </>
            )}
          </>
        )}

        {series.length === 0 && !loading && !error && (
          <ParagraphMedium marginTop="scale400" color="contentSecondary">
            Enter holdings and dates, then click Load chart.
          </ParagraphMedium>
        )}
      </PageCard>
    </Block>
  );
}
