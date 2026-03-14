export type AssetType = 'mutual_fund' | 'index_fund' | 'yahoo_finance' | 'fixed_return' | 'inflation';

export interface BaseAsset {
  id: string | number;
  name: string;
  type: AssetType;
}

export interface MutualFund extends BaseAsset {
  type: 'mutual_fund';
  id: number;
  schemeCode: number;
  schemeName: string;
}

export interface IndexFund extends BaseAsset {
  type: 'index_fund';
  id: string;
  indexName: string;
  displayName: string;
}

export interface YahooFinanceAsset extends BaseAsset {
  type: 'yahoo_finance';
  id: string;
  symbol: string;
  displayName: string;
}

export interface FixedReturnAsset extends BaseAsset {
  type: 'fixed_return';
  id: string;
  annualReturnPercentage: number;
  displayName: string;
}

export interface InflationAsset extends BaseAsset {
  type: 'inflation';
  id: string;
  displayName: string;
  countryCode: string; // e.g., 'IND' for India
}

export type Asset = MutualFund | IndexFund | YahooFinanceAsset | FixedReturnAsset | InflationAsset;

export interface AssetNavData {
  date: Date;
  nav: number;
}