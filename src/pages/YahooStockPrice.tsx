import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { Input } from 'baseui/input';
import { Table } from 'baseui/table-semantic';
import { LabelMedium, ParagraphMedium } from 'baseui/typography';
import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StockPriceChart } from '../components/charts/StockPriceChart';
import { yahooFinanceService } from '../services/yahooFinanceService';

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getMonthStartPrices(data: Array<{ date: Date; nav: number }>, startDate: string, endDate: string): Array<{ date: Date; nav: number }> {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T23:59:59Z');
  const monthMap = new Map<string, { date: Date; nav: number }>();

  data.forEach((p) => {
    if (p.date < start || p.date > end) return;
    const key = `${p.date.getUTCFullYear()}-${(p.date.getUTCMonth() + 1).toString().padStart(2, '0')}`;
    const current = monthMap.get(key);
    if (!current || p.date < current.date) {
      monthMap.set(key, { date: p.date, nav: p.nav });
    }
  });

  return Array.from(monthMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

function getMonthEndPrices(data: Array<{ date: Date; nav: number }>, startDate: string, endDate: string): Array<{ date: Date; nav: number }> {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T23:59:59Z');
  const monthMap = new Map<string, { date: Date; nav: number }>();

  data.forEach((p) => {
    if (p.date < start || p.date > end) return;
    const key = `${p.date.getUTCFullYear()}-${(p.date.getUTCMonth() + 1).toString().padStart(2, '0')}`;
    const current = monthMap.get(key);
    if (!current || p.date > current.date) {
      monthMap.set(key, { date: p.date, nav: p.nav });
    }
  });

  return Array.from(monthMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

function defaultStartDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function defaultEndDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const YahooStockPrice: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTicker = searchParams.get('ticker') ?? 'AAPL';
  const [ticker, setTicker] = useState<string>(initialTicker.toUpperCase());
  const [startDate, setStartDate] = useState<string>(() => searchParams.get('start') ?? defaultStartDate());
  const [endDate, setEndDate] = useState<string>(() => searchParams.get('end') ?? defaultEndDate());
  const [priceData, setPriceData] = useState<Array<{ date: Date; nav: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDateInvalid = new Date(startDate) > new Date(endDate);

  const normalizedTicker = ticker.trim().toUpperCase();

  const monthStartData = useMemo(() => getMonthStartPrices(priceData, startDate, endDate), [priceData, startDate, endDate]);
  const monthEndData = useMemo(() => getMonthEndPrices(priceData, startDate, endDate), [priceData, startDate, endDate]);

  const monthStartSummary = useMemo(() => ({
    start: monthStartData[0]?.nav ?? null,
    end: monthStartData[monthStartData.length - 1]?.nav ?? null,
  }), [monthStartData]);

  const monthEndSummary = useMemo(() => ({
    start: monthEndData[0]?.nav ?? null,
    end: monthEndData[monthEndData.length - 1]?.nav ?? null,
  }), [monthEndData]);

  const dailySummary = useMemo(() => ({
    start: priceData[0]?.nav ?? null,
    end: priceData[priceData.length - 1]?.nav ?? null,
  }), [priceData]);

  const handleFetch = async () => {
    setError(null);
    if (!normalizedTicker) {
      setError('Please enter a ticker.');
      return;
    }
    if (isDateInvalid) {
      setError('Start date must be before or equal to end date.');
      return;
    }

    setLoading(true);
    setPriceData([]);

    try {
      setSearchParams({ ticker: normalizedTicker, start: startDate, end: endDate });
      const data = await yahooFinanceService.fetchStockData(normalizedTicker, { startDate, endDate });
      setPriceData(data);
    } catch (err) {
      const message = (err as Error).message || 'Error fetching data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = () => {
    if (priceData.length === 0) return;
    const lines = ['Date,AdjClose'];

    priceData.forEach((item) => {
      lines.push(`${formatDate(item.date)},${item.nav.toFixed(2)}`);
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${normalizedTicker}_adj_close_daily.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Block position="relative">
      <Block maxWidth="900px" margin="0 auto" marginBottom="scale400" paddingTop="0" display="flex" justifyContent="center">
        <ParagraphMedium color="contentTertiary" marginTop="0" marginBottom="0">
          One ticker price info (month start + month end), plus CSV download and a chart.
        </ParagraphMedium>
      </Block>

      <Block maxWidth="900px" margin="0 auto" padding="scale600" backgroundColor="backgroundPrimary" overrides={{ Block: { style: { borderRadius: '10px', border: '1px solid #e5e7eb' } } }}>
        <Block display="flex" flexWrap="wrap" gridGap="scale500" marginBottom="scale400" alignItems="flex-end">
          <Block display="flex" flexDirection="column" gridGap="scale100">
            <LabelMedium>Ticker</LabelMedium>
            <Input value={ticker} onChange={(e) => setTicker((e.target as HTMLInputElement).value.toUpperCase())} placeholder="AAPL" size="compact" />
          </Block>
          <Block display="flex" flexDirection="column" gridGap="scale100">
            <LabelMedium>Start Date</LabelMedium>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #e5e7eb', fontSize: '14px', fontFamily: 'inherit' }} />
          </Block>
          <Block display="flex" flexDirection="column" gridGap="scale100">
            <LabelMedium>End Date</LabelMedium>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #e5e7eb', fontSize: '14px', fontFamily: 'inherit' }} />
          </Block>
          <Button kind="primary" onClick={handleFetch} isLoading={loading} disabled={isDateInvalid || loading}>Fetch</Button>
          <Button kind="secondary" onClick={downloadCsv} disabled={priceData.length === 0}>Download CSV</Button>
        </Block>

        {error && <ParagraphMedium marginTop="scale200" color="contentNegative">{error}</ParagraphMedium>}

        {priceData.length === 0 ? (
          <ParagraphMedium marginTop="scale400">No data yet. Click Fetch to load data.</ParagraphMedium>
        ) : (
          <>
            <Block marginTop="scale400" display="flex" gap="scale500" flexWrap="wrap">
              <Block>
                <LabelMedium>Summary</LabelMedium>
                <ParagraphMedium marginTop="0">Month-start: {monthStartSummary.start != null ? monthStartSummary.start.toFixed(2) : 'N/A'} → {monthStartSummary.end != null ? monthStartSummary.end.toFixed(2) : 'N/A'}</ParagraphMedium>
                <ParagraphMedium marginTop="0">Month-end: {monthEndSummary.start != null ? monthEndSummary.start.toFixed(2) : 'N/A'} → {monthEndSummary.end != null ? monthEndSummary.end.toFixed(2) : 'N/A'}</ParagraphMedium>
              </Block>
            </Block>

            <StockPriceChart
              data={priceData}
              ticker={normalizedTicker}
            />

            <Table
              columns={['Date', 'Adj Close']}
              data={priceData.map((item) => [formatDate(item.date), item.nav.toFixed(2)])}
              divider="horizontal"
              size="compact"
            />
          </>
        )}
      </Block>
    </Block>
  );
};
