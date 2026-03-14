import { useCallback } from 'react';
import { Asset } from '../types/asset';
import { fetchNavData } from '../services/mfapiNavService';
import { indexService } from '../services/indexService';
import { yahooFinanceService } from '../services/yahooFinanceService';
import { fixedReturnService } from '../services/fixedReturnService';
import { inflationService } from '../services/inflationService';

export const useAssetNavData = () => {
  const loadNavData = useCallback(async (asset: Asset) => {
    switch (asset.type) {
      case 'mutual_fund':
        return fetchNavData(asset.schemeCode);
      case 'index_fund':
        return indexService.fetchIndexData(asset.indexName);
      case 'yahoo_finance':
        return yahooFinanceService.fetchStockData(asset.symbol);
      case 'fixed_return':
        return fixedReturnService.generateFixedReturnData(
          asset.annualReturnPercentage,
          1990
        );
      case 'inflation':
        return inflationService.generateInflationNavData(
          asset.countryCode,
          1960 // World Bank data starts from 1960
        );
    }
  }, []);

  return { loadNavData };
};

