import { SipPortfolio } from '../../types/sipPortfolio';
import { LumpsumPortfolio } from '../../types/lumpsumPortfolio';
import { Asset } from '../../types/asset';

// Utility functions for reading and writing portfolios and years to the query string
export function getQueryParams(searchOverride?: string) {
  const search = searchOverride ?? window.location.search;
  const params = new URLSearchParams(search);
  const portfoliosParam = params.get('portfolios');
  const years = params.get('years');
  const sipAmount = params.get('sipAmount');
  const lumpsumPortfoliosParam = params.get('lumpsumPortfolios');
  const lumpsumAmount = params.get('lumpsumAmount');
  const assetsParam = params.get('assets');
  const defaultThreshold = 5; // Default threshold if not in query params

  return {
    lumpsumPortfolios: lumpsumPortfoliosParam
      ? lumpsumPortfoliosParam.split(';').map(portfolioStr => {
          // Format: asset1:alloc1,asset2:alloc2,...
          // asset format: type:id:allocation (e.g., mf:120716:50 or idx:NIFTY50:50 or fixed:8:50)
          const selectedAssets: (any | null)[] = [];
          const allocations: number[] = [];

          if (portfolioStr) {
            portfolioStr.split(',').forEach(assetData => {
              const assetParts = assetData.split(':');
              
              if (assetParts.length >= 2) {
                const type = assetParts[0];
                const alloc = Number(assetParts[assetParts.length - 1]);
                allocations.push(isNaN(alloc) ? 0 : alloc);
                
                if (type === 'null') {
                  selectedAssets.push(null);
                } else if (type === 'mf' && assetParts.length >= 3) {
                  const schemeCode = Number(assetParts[1]);
                  selectedAssets.push({
                    type: 'mutual_fund',
                    id: schemeCode,
                    name: `Scheme ${schemeCode}`,
                    schemeCode: schemeCode,
                    schemeName: `Scheme ${schemeCode}`
                  });
                } else if (type === 'idx' && assetParts.length >= 3) {
                  const indexName = assetParts[1].replace(/_/g, ' ');
                  selectedAssets.push({
                    type: 'index_fund',
                    id: indexName,
                    name: indexName,
                    indexName: indexName,
                    displayName: indexName
                  });
                } else if ((type === 'yahoo' || type === 'yahooinr') && assetParts.length >= 3) {
                  const symbol = assetParts[1];
                  selectedAssets.push({
                    type: 'yahoo_finance',
                    id: symbol,
                    name: symbol,
                    symbol: symbol,
                    displayName: symbol
                  });
                } else if (type === 'fixed' && assetParts.length >= 3) {
                  const returnPercentage = parseFloat(assetParts[1]);
                  selectedAssets.push({
                    type: 'fixed_return',
                    id: `fixed_${returnPercentage}`,
                    name: `Fixed ${returnPercentage}% Return`,
                    annualReturnPercentage: returnPercentage,
                    displayName: `Fixed ${returnPercentage}% Return`
                  });
                } else if (type === 'inflation' && assetParts.length >= 3) {
                  const countryCode = assetParts[1];
                  const countryNames: Record<string, string> = {
                    'IND': 'India - Consumer Price Index',
                    'USA': 'USA - Consumer Price Index'
                  };
                  const displayName = countryNames[countryCode] || `${countryCode} - Consumer Price Index`;
                  selectedAssets.push({
                    type: 'inflation',
                    id: `inflation_${countryCode}`,
                    name: displayName,
                    countryCode: countryCode,
                    displayName: displayName
                  });
                } else {
                  selectedAssets.push(null);
                }
              }
            });
          }
          
          return {
            selectedAssets,
            allocations
          };
        }).filter(s => s.allocations.length > 0)
      : [],
    lumpsumAmount: lumpsumAmount ? Number(lumpsumAmount) : 100000,
    assets: assetsParam
      ? assetsParam.split(';').map(instrStr => {
          const parts = instrStr.split(':');
          if (parts.length < 2) return null;
          
          const type = parts[0];
          
          if (type === 'mf') {
            const schemeCode = Number(parts[1]);
            return {
              type: 'mutual_fund' as const,
              id: schemeCode,
              name: `Scheme ${schemeCode}`,
              schemeCode: schemeCode,
              schemeName: `Scheme ${schemeCode}`
            };
          } else if (type === 'idx') {
            const indexName = parts[1].replace(/_/g, ' ');
            return {
              type: 'index_fund' as const,
              id: indexName,
              name: indexName,
              indexName: indexName,
              displayName: indexName
            };
          } else if (type === 'yahoo' || type === 'yahooinr') {
            const symbol = parts[1];
            return {
              type: 'yahoo_finance' as const,
              id: symbol,
              name: symbol,
              symbol: symbol,
              displayName: symbol
            };
          } else if (type === 'fixed') {
            const returnPercentage = parseFloat(parts[1]);
            return {
              type: 'fixed_return' as const,
              id: `fixed_${returnPercentage}`,
              name: `Fixed ${returnPercentage}% Return`,
              annualReturnPercentage: returnPercentage,
              displayName: `Fixed ${returnPercentage}% Return`
            };
          } else if (type === 'inflation') {
            const countryCode = parts[1];
            const countryNames: Record<string, string> = {
              'IND': 'India - Consumer Price Index',
              'USA': 'USA - Consumer Price Index'
            };
            const displayName = countryNames[countryCode] || `${countryCode} - Consumer Price Index`;
            return {
              type: 'inflation' as const,
              id: `inflation_${countryCode}`,
              name: displayName,
              countryCode: countryCode,
              displayName: displayName
            };
          }
          return null;
        }).filter((asset): asset is Asset => asset !== null)
      : [],
    portfolios: portfoliosParam
      ? portfoliosParam.split(';').map(p_str => {
          // Format: asset1:alloc1,asset2:alloc2,...|rebalFlag|rebalThreshold|stepUpFlag|stepUpPercentage
          // asset format: type:id:allocation (e.g., mf:120716:50 or idx:NIFTY50:50 or fixed:8:50)
          const parts = p_str.split('|');
          const assetsStr = parts[0];
          const rebalFlagStr = parts[1]; 
          const rebalThresholdStr = parts[2];
          const stepUpFlagStr = parts[3];
          const stepUpPercentageStr = parts[4];

          const selectedAssets: (any | null)[] = [];
          const allocations: number[] = [];

          if (assetsStr) {
            assetsStr.split(',').forEach(assetData => {
              const assetParts = assetData.split(':');
              
              if (assetParts.length >= 2) {
                const type = assetParts[0];
                const alloc = Number(assetParts[assetParts.length - 1]);
                allocations.push(isNaN(alloc) ? 0 : alloc);
                
                if (type === 'null') {
                  selectedAssets.push(null);
                } else if (type === 'mf' && assetParts.length >= 3) {
                  const schemeCode = Number(assetParts[1]);
                  selectedAssets.push({
                    type: 'mutual_fund',
                    id: schemeCode,
                    name: `Scheme ${schemeCode}`, // Will be updated by component
                    schemeCode: schemeCode,
                    schemeName: `Scheme ${schemeCode}` // Will be updated by component
                  });
                } else if (type === 'idx' && assetParts.length >= 3) {
                  // Convert underscores back to spaces
                  const indexName = assetParts[1].replace(/_/g, ' ');
                  selectedAssets.push({
                    type: 'index_fund',
                    id: indexName,
                    name: indexName,
                    indexName: indexName,
                    displayName: indexName
                  });
                } else if ((type === 'yahoo' || type === 'yahooinr') && assetParts.length >= 3) {
                  const symbol = assetParts[1];
                  selectedAssets.push({
                    type: 'yahoo_finance',
                    id: symbol,
                    name: symbol,
                    symbol: symbol,
                    displayName: symbol
                  });
                } else if (type === 'fixed' && assetParts.length >= 3) {
                  const returnPercentage = parseFloat(assetParts[1]);
                  selectedAssets.push({
                    type: 'fixed_return',
                    id: `fixed_${returnPercentage}`,
                    name: `Fixed ${returnPercentage}% Return`,
                    annualReturnPercentage: returnPercentage,
                    displayName: `Fixed ${returnPercentage}% Return`
                  });
                } else if (type === 'inflation' && assetParts.length >= 3) {
                  const countryCode = assetParts[1];
                  const countryNames: Record<string, string> = {
                    'IND': 'India - Consumer Price Index',
                    'USA': 'USA - Consumer Price Index'
                  };
                  const displayName = countryNames[countryCode] || `${countryCode} - Consumer Price Index`;
                  selectedAssets.push({
                    type: 'inflation',
                    id: `inflation_${countryCode}`,
                    name: displayName,
                    countryCode: countryCode,
                    displayName: displayName
                  });
                } else {
                  selectedAssets.push(null);
                }
              }
            });
          }
          
          // Default rebalancingEnabled to false if not present or not '1'
          const rebalancingEnabled = rebalFlagStr === '1';
          const rebalancingThreshold = rebalThresholdStr ? parseInt(rebalThresholdStr, 10) : defaultThreshold;
          
          // Default stepUpEnabled to false if not present or not '1'
          const stepUpEnabled = stepUpFlagStr === '1';
          const stepUpPercentage = stepUpPercentageStr ? parseInt(stepUpPercentageStr, 10) : 5;
          
          return {
            selectedAssets,
            allocations,
            rebalancingEnabled,
            rebalancingThreshold: isNaN(rebalancingThreshold) ? defaultThreshold : rebalancingThreshold,
            stepUpEnabled,
            stepUpPercentage: isNaN(stepUpPercentage) ? 5 : stepUpPercentage
          };
        }).filter(p => p.allocations.length > 0) // Filter out empty portfolios
      : [],
    years: years ? Number(years) : null,
    sipAmount: sipAmount ? Number(sipAmount) : 10000,
  };
}

export function setQueryParams(sipPortfolios: SipPortfolio[], years: number, sipAmount: number = 10000) {
  // Format: asset1:alloc1,asset2:alloc2,...|rebalFlag|rebalThreshold|stepUpFlag|stepUpPercentage
  // asset format: type:id (e.g., mf:120716 or idx:NIFTY50 or fixed:8)
  const portfoliosStr = sipPortfolios
    .map(p => {
      const assetsStr = p.selectedAssets
        .map((asset: any, idx: number) => {
          const allocation = p.allocations[idx] || 0;
          if (!asset) {
            return `null:${allocation}`;
          }
          if (asset.type === 'mutual_fund') {
            return `mf:${asset.schemeCode}:${allocation}`;
          } else if (asset.type === 'index_fund') {
            // Replace spaces with underscores for cleaner URLs
            const cleanIndexName = asset.indexName.replace(/\s+/g, '_');
            return `idx:${cleanIndexName}:${allocation}`;
          } else if (asset.type === 'yahoo_finance') {
            return `yahoo:${asset.symbol}:${allocation}`;
          } else if (asset.type === 'fixed_return') {
            return `fixed:${asset.annualReturnPercentage}:${allocation}`;
          } else if (asset.type === 'inflation') {
            return `inflation:${asset.countryCode}:${allocation}`;
          }
          return `null:${allocation}`;
        })
        .join(',');
      
      return `${assetsStr}|${p.rebalancingEnabled ? '1' : '0'}|${p.rebalancingThreshold}|${p.stepUpEnabled ? '1' : '0'}|${p.stepUpPercentage}`;
    })
    .join(';');
  
  // Construct URL manually since we're using safe characters now
  // Keep 'portfolios' param name for backward compatibility
  const urlParams = `portfolios=${portfoliosStr}&years=${years}&sipAmount=${sipAmount}`;
  window.history.replaceState({}, '', `?${urlParams}`);
}

export function setHistoricalValuesParams(assets: Asset[]) {
  // Format: type:id;type:id;...
  const assetsStr = assets
    .map(asset => {
      if (asset.type === 'mutual_fund') {
        return `mf:${asset.schemeCode}`;
      } else if (asset.type === 'index_fund') {
        const cleanIndexName = asset.indexName.replace(/\s+/g, '_');
        return `idx:${cleanIndexName}`;
      } else if (asset.type === 'yahoo_finance') {
        return `yahoo:${asset.symbol}`;
      } else if (asset.type === 'fixed_return') {
        return `fixed:${asset.annualReturnPercentage}`;
      } else if (asset.type === 'inflation') {
        return `inflation:${asset.countryCode}`;
      }
      return null;
    })
    .filter(s => s !== null)
    .join(';');
  
  const urlParams = `assets=${assetsStr}`;
  window.history.replaceState({}, '', `?${urlParams}`);
}