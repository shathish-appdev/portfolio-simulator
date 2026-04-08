import {
  buildNetWorthSeries,
  buildPerTickerValueSeries,
  mergeHoldingsByTicker,
  normalizePerTickerSeriesTo100,
} from './netWorthSeries';

describe('mergeHoldingsByTicker', () => {
  test('sums duplicate tickers', () => {
    expect(
      mergeHoldingsByTicker([
        { ticker: 'AAPL', units: 2 },
        { ticker: 'AAPL', units: 3 },
        { ticker: 'MSFT', units: 1 },
      ])
    ).toEqual([
      { ticker: 'AAPL', units: 5 },
      { ticker: 'MSFT', units: 1 },
    ]);
  });
});

describe('buildNetWorthSeries', () => {
  test('two tickers same dates: units * price summed', () => {
    const d0 = new Date(Date.UTC(2024, 0, 2));
    const d1 = new Date(Date.UTC(2024, 0, 3));
    const perTicker = new Map<string, Array<{ date: Date; nav: number }>>([
      ['A', [
        { date: d0, nav: 10 },
        { date: d1, nav: 20 },
      ]],
      ['B', [
        { date: d0, nav: 5 },
        { date: d1, nav: 5 },
      ]],
    ]);
    const start = new Date(Date.UTC(2024, 0, 1));
    const end = new Date(Date.UTC(2024, 0, 31));
    const out = buildNetWorthSeries(
      [
        { ticker: 'A', units: 2 },
        { ticker: 'B', units: 4 },
      ],
      perTicker,
      start,
      end
    );
    expect(out).toEqual([
      { date: d0, nav: 2 * 10 + 4 * 5 },
      { date: d1, nav: 2 * 20 + 4 * 5 },
    ]);
  });

  test('USD cash only: flat net worth each calendar day', () => {
    const start = new Date(Date.UTC(2024, 0, 1));
    const end = new Date(Date.UTC(2024, 0, 3));
    const perTicker = new Map<string, Array<{ date: Date; nav: number }>>();
    const out = buildNetWorthSeries([{ ticker: '~USD', units: 1000 }], perTicker, start, end);
    expect(out.map((p) => p.nav)).toEqual([1000, 1000, 1000]);
  });

  test('cash plus stock: cash adds flat amount', () => {
    const d0 = new Date(Date.UTC(2024, 0, 2));
    const d1 = new Date(Date.UTC(2024, 0, 3));
    const perTicker = new Map<string, Array<{ date: Date; nav: number }>>([
      ['A', [
        { date: d0, nav: 10 },
        { date: d1, nav: 20 },
      ]],
    ]);
    const start = new Date(Date.UTC(2024, 0, 1));
    const end = new Date(Date.UTC(2024, 0, 31));
    const out = buildNetWorthSeries(
      [
        { ticker: '~USD', units: 500 },
        { ticker: 'A', units: 2 },
      ],
      perTicker,
      start,
      end
    );
    expect(out).toEqual([
      { date: d0, nav: 500 + 2 * 10 },
      { date: d1, nav: 500 + 2 * 20 },
    ]);
  });
});

describe('buildPerTickerValueSeries', () => {
  test('splits position values by ticker', () => {
    const d0 = new Date(Date.UTC(2024, 0, 2));
    const d1 = new Date(Date.UTC(2024, 0, 3));
    const perTicker = new Map<string, Array<{ date: Date; nav: number }>>([
      ['A', [
        { date: d0, nav: 10 },
        { date: d1, nav: 20 },
      ]],
    ]);
    const start = new Date(Date.UTC(2024, 0, 1));
    const end = new Date(Date.UTC(2024, 0, 31));
    const out = buildPerTickerValueSeries(
      [
        { ticker: '~USD', units: 100 },
        { ticker: 'A', units: 2 },
      ],
      perTicker,
      start,
      end
    );
    expect(out.find((s) => s.ticker === 'USD cash')!.data.map((p) => p.nav)).toEqual([100, 100]);
    expect(out.find((s) => s.ticker === 'A')!.data.map((p) => p.nav)).toEqual([20, 40]);
  });
});

describe('normalizePerTickerSeriesTo100', () => {
  test('rebases each series to 100 at first point', () => {
    const d0 = new Date(Date.UTC(2024, 0, 1));
    const d1 = new Date(Date.UTC(2024, 0, 2));
    const out = normalizePerTickerSeriesTo100([
      { ticker: 'A', data: [{ date: d0, nav: 1000 }, { date: d1, nav: 2000 }] },
      { ticker: 'B', data: [{ date: d0, nav: 400 }, { date: d1, nav: 100 }] },
    ]);
    expect(out[0].data.map((p) => p.nav)).toEqual([100, 200]);
    expect(out[1].data.map((p) => p.nav)).toEqual([100, 25]);
  });
});
