import { yahooFinanceService } from './yahooFinanceService';

const d = (dateStr: string) => new Date(dateStr + 'T00:00:00Z');

describe('yahooFinanceService.fetchStockData', () => {
  beforeEach(() => {
    yahooFinanceService.clearCache();
  });

  test('should return raw data from cache', async () => {
    const stockData = [
      { date: d('2024-01-01'), nav: 500 },
    ];

    (yahooFinanceService as any).stockDataCache['AAPL'] = stockData;

    const result = await yahooFinanceService.fetchStockData('AAPL');
    expect(result).toEqual(stockData);
  });

  test('should clear cache', () => {
    (yahooFinanceService as any).stockDataCache['AAPL'] = [{ date: d('2024-01-01'), nav: 500 }];
    yahooFinanceService.clearCache();
    expect((yahooFinanceService as any).stockDataCache).toEqual({});
  });
});
