import { getQueryParams } from './queryParams';
import { setLumpsumQueryParams } from './queryParams-lumpsum';
import { LumpsumPortfolio } from '../../types/lumpsumPortfolio';

// Store search string for tests - getQueryParams accepts optional override
let mockSearch = '';

const mockLocation = (search: string) => {
  mockSearch = search.startsWith('?') ? search : `?${search}`;
};

// Mock window.history
const mockHistory = () => {
  delete (window as any).history;
  (window as any).history = {
    replaceState: jest.fn((_: any, __: any, url: string) => {
      mockLocation(url.split('?')[1] || '');
    })
  };
};

describe('Query Params - Lumpsum Portfolios', () => {
  beforeEach(() => {
    mockHistory();
  });

  test('should write and read lumpsum portfolios (round-trip)', () => {
    const portfolios: LumpsumPortfolio[] = [
      {
        selectedAssets: [{
          type: 'index_fund',
          id: 'NIFTY 50',
          name: 'NIFTY 50',
          indexName: 'NIFTY 50',
          displayName: 'NIFTY 50'
        }],
        allocations: [100]
      },
      {
        selectedAssets: [
          {
            type: 'mutual_fund',
            id: 122639,
            name: 'Scheme 122639',
            schemeCode: 122639,
            schemeName: 'Scheme 122639'
          },
          {
            type: 'mutual_fund',
            id: 120197,
            name: 'Scheme 120197',
            schemeCode: 120197,
            schemeName: 'Scheme 120197'
          }
        ],
        allocations: [70, 30]
      }
    ];
    
    setLumpsumQueryParams(portfolios, 7, 250000);
    const params = getQueryParams(mockSearch);
    
    expect(params.lumpsumPortfolios).toHaveLength(2);
    expect(params.years).toBe(7);
    expect(params.lumpsumAmount).toBe(250000);
    expect(params.lumpsumPortfolios[0].allocations).toEqual([100]);
    expect(params.lumpsumPortfolios[1].allocations).toEqual([70, 30]);
  });

  test('should handle all asset types', () => {
    mockLocation('lumpsumPortfolios=idx:NIFTY_50:100;fixed:8:50,inflation:IND:50');
    
    const params = getQueryParams(mockSearch);
    
    expect(params.lumpsumPortfolios).toHaveLength(2);
    expect(params.lumpsumPortfolios[0].selectedAssets[0].type).toBe('index_fund');
    expect(params.lumpsumPortfolios[1].selectedAssets[0].type).toBe('fixed_return');
    expect(params.lumpsumPortfolios[1].selectedAssets[1].type).toBe('inflation');
  });

  test('should return defaults when no params exist', () => {
    mockLocation('');
    
    const params = getQueryParams(mockSearch);
    
    expect(params.lumpsumPortfolios).toEqual([]);
    expect(params.lumpsumAmount).toBe(100000);
  });

  test('should round-trip yahoo finance assets', () => {
    const portfolios: LumpsumPortfolio[] = [
      {
        selectedAssets: [{
          type: 'yahoo_finance',
          id: '^GSPC',
          name: '^GSPC',
          symbol: '^GSPC',
          displayName: '^GSPC'
        }],
        allocations: [100]
      },
      {
        selectedAssets: [{
          type: 'yahoo_finance',
          id: 'AAPL',
          name: 'AAPL',
          symbol: 'AAPL',
          displayName: 'AAPL'
        }],
        allocations: [100]
      }
    ];

    setLumpsumQueryParams(portfolios, 5, 100000);
    const params = getQueryParams(mockSearch);

    expect(params.lumpsumPortfolios).toHaveLength(2);
    const asset0 = params.lumpsumPortfolios[0].selectedAssets[0];
    expect(asset0.type).toBe('yahoo_finance');
    expect(asset0.symbol).toBe('^GSPC');
    expect(asset0.displayName).toBe('^GSPC');

    const asset1 = params.lumpsumPortfolios[1].selectedAssets[0];
    expect(asset1.symbol).toBe('AAPL');
    expect(asset1.displayName).toBe('AAPL');
  });

  test('should parse yahoo from historical values URL', () => {
    mockLocation('assets=yahoo:^GSPC;yahoo:AAPL');
    const params = getQueryParams(mockSearch);

    expect(params.assets).toHaveLength(2);
    const a0 = params.assets[0] as any;
    const a1 = params.assets[1] as any;
    expect(a0.type).toBe('yahoo_finance');
    expect(a0.symbol).toBe('^GSPC');
    expect(a1.symbol).toBe('AAPL');
  });

  test('should parse yahooinr from URL for backward compatibility', () => {
    mockLocation('assets=yahooinr:^GSPC;yahoo:AAPL');
    const params = getQueryParams(mockSearch);

    expect(params.assets).toHaveLength(2);
    const a0 = params.assets[0] as any;
    expect(a0.type).toBe('yahoo_finance');
    expect(a0.symbol).toBe('^GSPC');
  });
});

