import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { Input } from 'baseui/input';
import { LabelMedium, ParagraphMedium } from 'baseui/typography';
import React, { useCallback, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
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
import { sendNetworthDataToGemini } from '../services/geminiService';

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

export function NetworthEstimatorCopyPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<HoldingRow[]>(() => parseHoldingsParam(searchParams.get('h')));
  const [startDate, setStartDate] = useState(() => searchParams.get('start') ?? defaultStartDate());
  const [endDate, setEndDate] = useState(() => searchParams.get('end') ?? defaultEndDate());
  const [series, setSeries] = useState<Array<{ date: Date; nav: number }>>([]);
  const [byTickerSeries, setByTickerSeries] = useState<StockSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geminiPrompt, setGeminiPrompt] = useState('');
  const [geminiResponse, setGeminiResponse] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

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

  const handleSend = useCallback(async () => {
    setError(null);
    setGeminiResponse(null);

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
    if (!geminiPrompt.trim()) {
      setError('Enter a Gemini prompt before sending.');
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

      const payload = {
        holdings: merged,
        startDate,
        endDate,
        netWorthSeries: nw,
        perHoldingSeries: perHolding,
      };

      try {
        const geminiResult = await sendNetworthDataToGemini(geminiPrompt.trim(), payload, geminiApiKey || undefined);
        setGeminiResponse(geminiResult);
      } catch (geminiError) {
        setError((geminiError as Error).message || 'Failed to send data to Gemini.');
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to load prices.');
    } finally {
      setLoading(false);
    }
  }, [holdingsParsed, rows, startDate, endDate, isDateInvalid, setSearchParams, geminiPrompt, geminiApiKey]);

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
        dollar cash-units are dollars (e.g. 5000 = $5,000). Choose a date range, then load charts: total net worth, each holding's
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
          <Block display="flex" flexDirection="column" gridGap="scale100" flex="1" minWidth="240px">
            <LabelMedium>Gemini prompt</LabelMedium>
            <Input
              value={geminiPrompt}
              onChange={(e) => setGeminiPrompt((e.target as HTMLInputElement).value)}
              placeholder="Ask Gemini about this portfolio"
              size="compact"
            />
          </Block>
          <Block display="flex" flexDirection="column" gridGap="scale100" flex="1" minWidth="260px">
            <LabelMedium>Gemini API key <span style={{ fontWeight: 400, color: '#64748b', fontSize: '12px' }}>(optional — overrides env key)</span></LabelMedium>
            <Block display="flex" gridGap="scale200" alignItems="center">
              <Input
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey((e.target as HTMLInputElement).value)}
                placeholder="AIzaSy..."
                size="compact"
                type={showApiKey ? 'text' : 'password'}
                overrides={{ Root: { style: { flex: '1' } } }}
              />
              <Button kind="tertiary" size="compact" onClick={() => setShowApiKey(v => !v)}>
                {showApiKey ? 'Hide' : 'Show'}
              </Button>
            </Block>
          </Block>
          <Block display="flex" flexDirection="column" gridGap="scale100">
            <LabelMedium>Start date</LabelMedium>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={dateInputStyle} />
          </Block>
          <Block display="flex" flexDirection="column" gridGap="scale100">
            <LabelMedium>End date</LabelMedium>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={dateInputStyle} />
          </Block>
          <Button
            kind="primary"
            onClick={() => void handleSend()}
            isLoading={loading}
            disabled={!geminiPrompt.trim() || isDateInvalid || loading}
          >
            Send
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

        {geminiResponse && (
          <Block marginTop="scale600" overrides={{ Block: { style: { borderRadius: '16px', border: '1px solid #e0e7ff', background: 'linear-gradient(135deg, #f8faff 0%, #ffffff 100%)', boxShadow: '0 2px 12px rgba(79,70,229,0.07)', overflow: 'hidden' } } }}>
            {/* Header bar */}
            <Block display="flex" alignItems="center" padding="scale500" overrides={{ Block: { style: { borderBottom: '1px solid #e0e7ff', background: 'rgba(79,70,229,0.04)' } } }}>
              <Block overrides={{ Block: { style: { width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: '0', fontSize: '14px', color: '#fff' } } }}>✦</Block>
              <Block overrides={{ Block: { style: { fontWeight: '600', fontSize: '13px', color: '#4f46e5', letterSpacing: '0.02em', textTransform: 'uppercase' } } }}>AI Analysis</Block>
            </Block>
            {/* Content */}
            <Block padding="scale600" overrides={{ Block: { style: { lineHeight: '1.7', color: '#1e293b', fontSize: '14px' } } }}>
              <style>{`
                .gemini-response h1,.gemini-response h2 { font-size: 1rem; font-weight: 700; margin: 1.1rem 0 0.4rem; color: #0f172a; padding-bottom: 4px; border-bottom: 1px solid #e0e7ff; }
                .gemini-response h3 { font-size: 0.95rem; font-weight: 600; margin: 0.9rem 0 0.3rem; color: #3730a3; }
                .gemini-response p { margin: 0.45rem 0; color: #334155; }
                .gemini-response ul { padding-left: 1.2rem; margin: 0.4rem 0; list-style: none; }
                .gemini-response ul li::before { content: '▸'; color: #6366f1; font-size: 0.75em; margin-right: 6px; }
                .gemini-response ol { padding-left: 1.4rem; margin: 0.4rem 0; }
                .gemini-response li { margin: 0.3rem 0; color: #334155; }
                .gemini-response strong { font-weight: 600; color: #0f172a; }
                .gemini-response em { font-style: italic; color: #475569; }
                .gemini-response code { background: #ede9fe; padding: 2px 7px; border-radius: 5px; font-size: 0.82em; font-family: monospace; color: #4f46e5; }
                .gemini-response pre { background: #1e1b4b; padding: 14px; border-radius: 10px; overflow-x: auto; font-size: 0.82em; margin: 0.8rem 0; }
                .gemini-response pre code { background: none; padding: 0; color: #c7d2fe; }
                .gemini-response blockquote { border-left: 3px solid #6366f1; padding: 6px 12px; color: #64748b; margin: 0.6rem 0; background: #f5f3ff; border-radius: 0 6px 6px 0; font-style: italic; }
                .gemini-response table { border-collapse: collapse; width: 100%; margin: 0.8rem 0; font-size: 13px; }
                .gemini-response th { background: #ede9fe; color: #3730a3; font-weight: 600; padding: 8px 12px; border: 1px solid #ddd6fe; }
                .gemini-response td { padding: 7px 12px; border: 1px solid #e0e7ff; color: #334155; }
                .gemini-response tr:nth-child(even) td { background: #f8f7ff; }
                .gemini-response hr { border: none; border-top: 1px solid #e0e7ff; margin: 1rem 0; }
              `}</style>
              <div className="gemini-response">
                <ReactMarkdown>{geminiResponse}</ReactMarkdown>
              </div>
            </Block>
          </Block>
        )}

        {series.length === 0 && !loading && !error && (
          <ParagraphMedium marginTop="scale400" color="contentSecondary">
            Enter holdings and dates, then click Send.
          </ParagraphMedium>
        )}
      </PageCard>
    </Block>
  );
}
