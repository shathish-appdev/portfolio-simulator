import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { Input } from 'baseui/input';
import { RadioGroup, Radio } from 'baseui/radio';
import { LabelMedium } from 'baseui/typography';
import React, { useState } from 'react';
import { WeeklyHighLowChart } from '../components/charts/WeeklyHighLowChart';
import { LoadingOverlay } from '../components/common/LoadingOverlay';
import { yahooFinanceService } from '../services/yahooFinanceService';
import { aggregateWeeklyOHLC, aggregateMonthlyOHLC } from '../utils/data/aggregateWeeklyOHLC';
import { ProcessedOHLCData } from '../types/index';

const dateInputStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '14px',
  backgroundColor: '#ffffff',
  color: '#374151',
  width: '140px',
};

const defaultStartDate = (): string => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().split('T')[0];
};

const defaultEndDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

export const WeeklyStockPricePage: React.FC = () => {
  const [ticker, setTicker] = useState<string>('AAPL');
  const [startDate, setStartDate] = useState<string>(defaultStartDate());
  const [endDate, setEndDate] = useState<string>(defaultEndDate());
  const [data, setData] = useState<ProcessedOHLCData[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewType, setViewType] = useState<'weekly' | 'monthly'>('weekly');

  const isDateRangeInvalid = new Date(startDate) > new Date(endDate);

  const handlePlot = async () => {
    if (!ticker.trim() || isDateRangeInvalid) return;

    setLoading(true);
    setData([]);
    try {
      const dailyData = await yahooFinanceService.fetchStockOHLCData(ticker.trim().toUpperCase(), {
        startDate,
        endDate,
      });

      const aggregatedData = viewType === 'weekly'
        ? aggregateWeeklyOHLC(dailyData)
        : aggregateMonthlyOHLC(dailyData);

      setData(aggregatedData);
    } catch (error) {
      console.error('Error fetching stock data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Block position="relative">
      <LoadingOverlay active={loading} />

      <Block maxWidth="900px" margin="0 auto" marginBottom="scale400" paddingTop="0" display="flex" justifyContent="center">
        <LabelMedium color="contentTertiary" marginTop="0" marginBottom="0">
          View {viewType === 'weekly' ? 'weekly' : 'monthly'} high and low prices for a stock
        </LabelMedium>
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
          <Block display="flex" alignItems="center" gridGap="scale300" flexWrap="wrap" marginTop="scale400">
            <LabelMedium marginBottom="0" marginTop="0">Ticker</LabelMedium>
            <Input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="e.g. AAPL"
              overrides={{
                Root: { style: { width: '100px' } },
              }}
            />
            <LabelMedium marginBottom="0" marginTop="0">Start Date</LabelMedium>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={dateInputStyle} />
            <LabelMedium marginBottom="0" marginTop="0">End Date</LabelMedium>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={dateInputStyle} />
            
            <Block display="flex" flexDirection="column" marginLeft="scale400">
              <LabelMedium marginBottom="scale200" marginTop="0">View Type</LabelMedium>
              <RadioGroup
                value={viewType}
                onChange={(e) => setViewType(e.target.value as 'weekly' | 'monthly')}
                name="view-type"
              >
                <Radio value="weekly">Weekly</Radio>
                <Radio value="monthly">Monthly</Radio>
              </RadioGroup>
            </Block>
            
            <Button kind="primary" onClick={handlePlot} disabled={!ticker.trim() || isDateRangeInvalid}>
              Plot
            </Button>
            {isDateRangeInvalid && (
              <LabelMedium marginBottom="0" marginTop="0" overrides={{ Block: { style: ({ $theme }) => ({ color: $theme.colors.negative }) } }}>
                Start date must be before end date
              </LabelMedium>
            )}
          </Block>
        </Block>

        {data.length > 0 && (
          <Block maxWidth="90%" margin="0 auto">
            <WeeklyHighLowChart data={data} ticker={ticker.trim().toUpperCase()} viewType={viewType} />
          </Block>
        )}
      </Block>
    </Block>
  );
};