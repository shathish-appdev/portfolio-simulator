import { LumpsumPortfolio } from '../../types/lumpsumPortfolio';

// Simple version for lumpsum (no rebalancing, no step-up)
export function setLumpsumQueryParams(lumpsumPortfolios: LumpsumPortfolio[], years: number, lumpsumAmount: number = 100000) {
  // For now, use same format as SIP but without rebalancing/stepup params
  const portfoliosStr = lumpsumPortfolios
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
            const cleanIndexName = asset.indexName.replace(/\s+/g, '_');
            return `idx:${cleanIndexName}:${allocation}`;
          } else if (asset.type === 'yahoo_finance') {
            const prefix = 'yahoo';
            return `${prefix}:${asset.symbol}:${allocation}`;
          } else if (asset.type === 'fixed_return') {
            return `fixed:${asset.annualReturnPercentage}:${allocation}`;
          } else if (asset.type === 'inflation') {
            return `inflation:${asset.countryCode}:${allocation}`;
          }
          return `null:${allocation}`;
        })
        .join(',');
      
      return assetsStr;
    })
    .join(';');
  
  const urlParams = `lumpsumPortfolios=${portfoliosStr}&years=${years}&lumpsumAmount=${lumpsumAmount}`;
  window.history.replaceState({}, '', `?${urlParams}`);
}

