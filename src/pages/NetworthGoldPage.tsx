import React, { useState, useCallback, useMemo } from 'react';
import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { Input } from 'baseui/input';
import { LabelMedium, ParagraphMedium } from 'baseui/typography';

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

export default function NetworthGoldPage(): React.ReactElement {
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [startDate, setStartDate] = useState(defaultStartDate());
  const [endDate, setEndDate] = useState(defaultEndDate());

  const [portfolioSeries, setPortfolioSeries] = useState<DataPoint[]>([]);
  const [stockSeries, setStockSeries] = useState<StockSeries[]>([]);
  const [goldSeries, setGoldSeries] = useState<DataPoint[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Parse input
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

  const handleLoad = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (parsed.length === 0) {
        setError('Add at least one valid holding.');
        return;
      }

      if (new Date(startDate) > new Date(endDate)) {
        setError('Invalid date range.');
        return;
      }

      // ❗ Prevent wrong ticker
      if (parsed.some((p) => p.ticker === 'GOLD')) {
        setError('Use GLD for gold benchmark. "GOLD" is a stock.');
        return;
      }

      // 🪙 Fetch GLD (gold benchmark)
      const gldData: DataPoint[] =
        await yahooFinanceService.fetchStockData('GLD', {
          startDate,
          endDate,
        });

      if (!gldData || gldData.length < 2) {
        setError('GLD data not available.');
        return;
      }

      // 📈 Fetch stocks
      const stockResults = await Promise.all(
        parsed.map((p) =>
          yahooFinanceService.fetchStockData(p.ticker, {
            startDate,
            endDate,
          })
        )
      );

      // 📊 Stock chart
      const stockChart: StockSeries[] = parsed.map((p, i) => ({
        ticker: p.ticker,
        data: stockResults[i],
      }));

      setStockSeries(stockChart);
      setGoldSeries(gldData);

      // Align data
      const minLength = Math.min(
        gldData.length,
        ...stockResults.map((s) => s.length)
      );

      if (minLength < 2) {
        setError('Not enough overlapping data.');
        return;
      }

      // 💰 Portfolio in GOLD
      const result: DataPoint[] = [];

      for (let i = 0; i < minLength; i++) {
        let totalUSD = 0;

        for (let j = 0; j < stockResults.length; j++) {
          totalUSD +=
            (stockResults[j][i]?.nav ?? 0) * parsed[j].units;
        }

        const gldPrice = gldData[i]?.nav ?? 1;

        result.push({
          date: gldData[i].date,
          nav: totalUSD / gldPrice, // ✅ CORE LOGIC
        });
      }

      setPortfolioSeries(result);
    } catch (err) {
      console.error(err);
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [parsed, startDate, endDate]);

  return (
    <Block position="relative">
      <LoadingOverlay active={loading} />

      <PageIntro title="Net worth in GOLD">
        Convert your portfolio into GOLD units using GLD ETF price.
      </PageIntro>

      <PageCard>
        {/* Holdings */}
        <Block marginBottom="scale500">
          <LabelMedium marginBottom="scale200">Holdings</LabelMedium>

          {rows.map((r) => (
            <Block
              key={r.id}
              display="flex"
              gridGap="scale300"
              marginBottom="scale300"
            >
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

              <Button kind="secondary" onClick={() => removeRow(r.id)}>
                Remove
              </Button>
            </Block>
          ))}

          <Button kind="secondary" onClick={addRow}>
            Add Holding
          </Button>
        </Block>

        {/* Dates */}
        <Block display="flex" gridGap="scale400" marginBottom="scale400">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />

          <Button onClick={handleLoad} isLoading={loading}>
            Load GOLD View
          </Button>
        </Block>

        {/* Error */}
        {error && (
          <ParagraphMedium color="contentNegative">
            {error}
          </ParagraphMedium>
        )}

        {/* Charts */}
        {portfolioSeries.length >= 2 && (
          <>
            {/* 📈 Stocks */}
            <StockPriceChart
              series={stockSeries}
              multiChartTitle="Stock Prices"
              multiValueAxisTitle="Price (USD)"
            />

            {/* 🪙 Gold */}
            <StockPriceChart
              data={goldSeries}
              ticker="GLD"
              chartTitle="Gold Price (GLD)"
              valueAxisTitle="Price (USD)"
            />

            {/* 💰 Portfolio */}
            <StockPriceChart
              data={portfolioSeries}
              ticker="Portfolio (Gold)"
              chartTitle="Portfolio in GOLD"
              valueAxisTitle="Gold Units"
            />
          </>
        )}
      </PageCard>
    </Block>
  );
}