import { splitTickerAmountSegment } from './tickerAmountUrl';

describe('splitTickerAmountSegment', () => {
  test('plain ticker and amount', () => {
    expect(splitTickerAmountSegment('VOO:12000')).toEqual({ ticker: 'VOO', amount: '12000' });
  });

  test('synthetic ~TARGET_RATE:10 with amount (last colon wins)', () => {
    expect(splitTickerAmountSegment('~TARGET_RATE:10:5000')).toEqual({
      ticker: '~TARGET_RATE:10',
      amount: '5000',
    });
  });

  test('synthetic ~12', () => {
    expect(splitTickerAmountSegment('~12:1000')).toEqual({ ticker: '~12', amount: '1000' });
  });
});
