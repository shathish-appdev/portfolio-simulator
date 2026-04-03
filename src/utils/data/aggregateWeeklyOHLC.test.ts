import { aggregateWeeklyOHLC } from './aggregateWeeklyOHLC';
import { ProcessedOHLCData } from '../../types/index';

describe('aggregateWeeklyOHLC', () => {
  it('should aggregate daily OHLC data into weekly data', () => {
    const dailyData: ProcessedOHLCData[] = [
      { date: new Date('2023-01-02'), open: 100, high: 105, low: 95, close: 102 }, // Monday
      { date: new Date('2023-01-03'), open: 102, high: 108, low: 98, close: 106 },
      { date: new Date('2023-01-04'), open: 106, high: 110, low: 100, close: 108 },
      { date: new Date('2023-01-05'), open: 108, high: 112, low: 105, close: 110 },
      { date: new Date('2023-01-06'), open: 110, high: 115, low: 107, close: 113 },
      { date: new Date('2023-01-09'), open: 113, high: 120, low: 110, close: 118 }, // Next Monday
      { date: new Date('2023-01-10'), open: 118, high: 125, low: 115, close: 122 },
    ];

    const result = aggregateWeeklyOHLC(dailyData);

    expect(result).toHaveLength(2);

    // First week
    expect(result[0].date.getTime()).toBe(new Date('2023-01-02').getTime()); // Monday
    expect(result[0].open).toBe(100);
    expect(result[0].high).toBe(115); // max of highs
    expect(result[0].low).toBe(95); // min of lows
    expect(result[0].close).toBe(113);
    expect(result[0].highDate?.getTime()).toBe(new Date('2023-01-06').getTime()); // Date of highest high
    expect(result[0].lowDate?.getTime()).toBe(new Date('2023-01-02').getTime()); // Date of lowest low

    // Second week
    expect(result[1].date.getTime()).toBe(new Date('2023-01-09').getTime()); // Monday
    expect(result[1].open).toBe(113);
    expect(result[1].high).toBe(125);
    expect(result[1].low).toBe(110);
    expect(result[1].close).toBe(122);
    expect(result[1].highDate?.getTime()).toBe(new Date('2023-01-10').getTime()); // Date of highest high
    expect(result[1].lowDate?.getTime()).toBe(new Date('2023-01-09').getTime()); // Date of lowest low
  });

  it('should handle empty data', () => {
    const result = aggregateWeeklyOHLC([]);
    expect(result).toEqual([]);
  });

  it('should handle single day', () => {
    const dailyData: ProcessedOHLCData[] = [
      { date: new Date('2023-01-02'), open: 100, high: 105, low: 95, close: 102 },
    ];

    const result = aggregateWeeklyOHLC(dailyData);

    expect(result).toHaveLength(1);
    expect(result[0].date).toEqual(dailyData[0].date);
    expect(result[0].open).toBe(100);
    expect(result[0].high).toBe(105);
    expect(result[0].low).toBe(95);
    expect(result[0].close).toBe(102);
    expect(result[0].highDate).toEqual(dailyData[0].date);
    expect(result[0].lowDate).toEqual(dailyData[0].date);
  });
});