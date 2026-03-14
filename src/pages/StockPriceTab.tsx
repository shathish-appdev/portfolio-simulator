import React, { useState } from 'react';
import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { Input } from 'baseui/input';
import { LabelMedium, ParagraphMedium } from 'baseui/typography';
import { LoadingOverlay } from '../components/common/LoadingOverlay';
import { fillMissingNavDates } from '../utils/data/fillMissingNavDates';
import { yahooFinanceService } from '../services/yahooFinanceService';
import { StockPriceChart } from '../components/charts/StockPriceChart';
import { mfapiMutualFund } from '../types/mfapiMutualFund';

function filterByStartDate(
  data: Array<{ date: Date; nav: number }>,
  startDate: Date | null
): Array<{ date: Date; nav: number }> {
  if (!startDate) return data;
  const startTime = startDate.getTime();
  return data.filter(item => item.date.getTime() >= startTime);
}

interface StockPriceTabProps {
  funds: mfapiMutualFund[];
  loadNavData?: (asset: any) => Promise<any[]>;
}

export const StockPriceTab: React.FC<StockPriceTabProps> = () => {
  const [ticker, setTicker] = useState('');
  const [priceData, setPriceData] = useState<Array<{ date: Date; nav: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });

  const handlePlot = async () => {
    const symbol = ticker.trim().toUpperCase();
    if (!symbol) return;

    setLoading(true);
    try {
      const data = await yahooFinanceService.fetchStockData(symbol);
      const filled = fillMissingNavDates(data);
      setPriceData(filled);
    } catch (error) {
      console.error('Error fetching stock price:', error);
      setPriceData([]);
    } finally {
      setLoading(false);
    }
  };

  const setPresetDate = (preset: '1M' | '3M' | '6M' | '1Y' | '5Y') => {
    const d = new Date();
    if (preset === '1M') d.setMonth(d.getMonth() - 1);
    else if (preset === '3M') d.setMonth(d.getMonth() - 3);
    else if (preset === '6M') d.setMonth(d.getMonth() - 6);
    else if (preset === '1Y') d.setFullYear(d.getFullYear() - 1);
    else if (preset === '5Y') d.setFullYear(d.getFullYear() - 5);
    setStartDate(d.toISOString().slice(0, 10));
  };

  const filteredData = filterByStartDate(priceData, startDate ? new Date(startDate) : null);

  return (
    <Block position="relative">
      <LoadingOverlay active={loading} />

      <Block maxWidth="900px" margin="0 auto" marginBottom="scale400" paddingTop="0" display="flex" justifyContent="center">
        <ParagraphMedium color="contentTertiary" marginTop="0" marginBottom="0">
          View stock price over time. Enter a Yahoo Finance ticker (e.g. AAPL, GOOG, MSFT).
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
              })
            }
          }}
        >
          <Block display="flex" alignItems="center" gridGap="scale500" flexWrap="wrap">
            <Block display="flex" alignItems="center" gridGap="scale300">
              <Input
                value={ticker}
                onChange={(e) => setTicker((e.target as HTMLInputElement).value.toUpperCase())}
                placeholder="Ticker (e.g. AAPL)"
                size="compact"
                overrides={{
                  Root: { style: { width: '200px', minWidth: '150px' } }
                }}
              />
              <Button
                kind="primary"
                onClick={handlePlot}
                disabled={!ticker.trim()}
              >
                Plot
              </Button>
            </Block>
            <Block display="flex" alignItems="center" gridGap="scale300" flexWrap="wrap">
              <LabelMedium marginBottom="0" marginTop="0">Start Date</LabelMedium>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #e5e7eb',
                  fontSize: '14px',
                  fontFamily: 'inherit'
                }}
              />
              {(['1M', '3M', '6M', '1Y', '5Y'] as const).map((preset) => (
                <Button
                  key={preset}
                  kind="tertiary"
                  size="mini"
                  onClick={() => setPresetDate(preset)}
                  overrides={{
                    BaseButton: {
                      style: { minWidth: '40px', paddingLeft: '12px', paddingRight: '12px' }
                    }
                  }}
                >
                  {preset}
                </Button>
              ))}
            </Block>
          </Block>
        </Block>
      </Block>

      {filteredData.length > 0 && (
        <Block maxWidth="90%" margin="0 auto">
          <StockPriceChart
            data={filteredData}
            ticker={ticker.trim().toUpperCase()}
          />
        </Block>
      )}
    </Block>
  );
};
