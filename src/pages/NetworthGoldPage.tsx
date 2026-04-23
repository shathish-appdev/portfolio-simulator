import React, { useState, useCallback, useMemo } from 'react';
import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { Input } from 'baseui/input';
import { LabelMedium, ParagraphMedium } from 'baseui/typography';
import { useSearchParams } from 'react-router-dom';

import { PageCard, PageIntro } from '../components/common/PageChrome';
import { LoadingOverlay } from '../components/common/LoadingOverlay';
import { StockPriceChart } from '../components/charts/StockPriceChart';
import type { StockSeries } from '../components/charts/StockPriceChart';

import { yahooFinanceService } from '../services/yahooFinanceService';

type Row = {
  id: string;
  ticker: string;
  units: string;
};

type DataPoint = {
  date: Date;
  nav: number;
};

function newRow(): Row {
  return {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    ticker: '',
    units: '',
  };
}

function defaultStartDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function defaultEndDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function NetworthGoldPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [startDate, setStartDate] = useState(searchParams.get('start') || defaultStartDate());
  const [endDate, setEndDate] = useState(searchParams.get('end') || defaultEndDate());

  const [portfolioSeries, setPortfolioSeries] = useState<DataPoint[]>([]);
  const [stockSeries, setStockSeries] = useState<StockSeries[]>([]);
  const [goldSeries, setGoldSeries] = useState<DataPoint[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    return rows
      .map((r) => ({
        ticker: r.ticker.trim().toUpperCase(),
        units: parseFloat(r.units.replace(/,/g, '')),
      }))
      .filter((r) => r.ticker && !Number.isNaN(r.units) && r.units > 0);
  }, [rows]);

  const updateRow = (id: string, key: 'ticker' | 'units', value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [key]: value } : r))
    );
  };

  const addRow = () => setRows((prev) => [...prev, newRow()]);
  const removeRow = (id: string) => {
    setRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)
    );
  };

  function serialize(rows: Row[]) {
    return rows
      .map((r) => (r.ticker && r.units ? `${r.ticker}:${r.units}` : ''))
      .filter(Boolean)
      .join(',');
  }

  const handleLoad = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (parsed.length === 0) {
        setError('Add at least one valid holding.');
        return;
      }

      // ✅ Update URL (GET)
      const params = new URLSearchParams();
      params.set('start', startDate);
      params.set('end', endDate);
      params.set('h', serialize(rows));
      setSearchParams(params);

      // 🪙 GLD
      const gldData = await yahooFinanceService.fetchStockData('GLD', {
        startDate,
        endDate,
      });

      // 📈 Stocks
      const stockResults = await Promise.all(
        parsed.map((p) =>
          yahooFinanceService.fetchStockData(p.ticker, {
            startDate,
            endDate,
          })
        )
      );

      setStockSeries(
        parsed.map((p, i) => ({
          ticker: p.ticker,
          data: stockResults[i],
        }))
      );

      setGoldSeries(gldData);

      // 🔥 KEY FIX: DATE MAP
      const gldMap = new Map(
        gldData.map((d) => [formatDate(new Date(d.date)), d.nav])
      );

      const stockMaps = stockResults.map((series) =>
        new Map(series.map((d) => [formatDate(new Date(d.date)), d.nav]))
      );

      // 🔥 COMMON DATES ONLY
      const commonDates = [...gldMap.keys()].filter((date) =>
        stockMaps.every((m) => m.has(date))
      );

      if (commonDates.length < 2) {
        setError('Not enough overlapping data.');
        return;
      }

      // 💰 FINAL CORRECT CALCULATION
      const result: DataPoint[] = [];

      for (const date of commonDates) {
        let totalUSD = 0;

        for (let i = 0; i < stockMaps.length; i++) {
          const price = stockMaps[i].get(date)!;
          totalUSD += price * parsed[i].units;
        }

        const gldPrice = gldMap.get(date)!;

        result.push({
          date: new Date(date),
          nav: totalUSD / gldPrice,
        });
      }

      setPortfolioSeries(result);
    } catch (err) {
      console.error(err);
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [parsed, startDate, endDate, rows, setSearchParams]);

  return (
    <Block position="relative">
      <LoadingOverlay active={loading} />

      <PageIntro title="Net worth in GOLD">
        Convert your portfolio into GOLD units using GLD ETF price.
      </PageIntro>

      <PageCard>
        <Block marginBottom="scale500">
          <LabelMedium>Holdings</LabelMedium>

          {rows.map((r) => (
            <Block key={r.id} display="flex" gridGap="scale300" marginBottom="scale300">
              <Input
                value={r.ticker}
                placeholder="AAPL"
                onChange={(e) =>
                  updateRow(r.id, 'ticker', (e.target as HTMLInputElement).value)
                }
              />

              <Input
                value={r.units}
                placeholder="10"
                onChange={(e) =>
                  updateRow(r.id, 'units', (e.target as HTMLInputElement).value)
                }
              />

              <Button onClick={() => removeRow(r.id)}>Remove</Button>
            </Block>
          ))}

          <Button onClick={addRow}>Add Holding</Button>
        </Block>

        <Block display="flex" gridGap="scale400" marginBottom="scale400">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

          <Button onClick={handleLoad} isLoading={loading}>
            Load GOLD View
          </Button>
        </Block>

        {error && <ParagraphMedium color="contentNegative">{error}</ParagraphMedium>}

        {portfolioSeries.length >= 2 && (
          <>
            <StockPriceChart series={stockSeries} multiChartTitle="Stock Prices" />
            <StockPriceChart data={goldSeries} ticker="GLD" chartTitle="Gold Price" />
            <StockPriceChart data={portfolioSeries} ticker="Portfolio" chartTitle="Portfolio in GOLD" />
          </>
        )}
      </PageCard>
    </Block>
  );
}