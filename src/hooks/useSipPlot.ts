import { useCallback } from 'react';
import { fillMissingNavDates } from '../utils/data/fillMissingNavDates';
import { indexService } from '../services/indexService';
import { yahooFinanceService } from '../services/yahooFinanceService';
import { fixedReturnService } from '../services/fixedReturnService';
import { inflationService } from '../services/inflationService';
import { trackSimulation } from '../utils/analytics';

export function useSipPlot({
  sipPortfolios,
  years,
  loadNavData,
  plotState,
  sipAmount,
  chartView,
}) {
  // Handler for plotting all portfolios
  const handlePlotAllPortfolios = useCallback(async () => {
    trackSimulation('SIP', 'Plot');
    plotState.setLoadingNav(true);
    plotState.setLoadingXirr(false);
    plotState.setHasPlotted(false);
    plotState.setNavDatas({});
    plotState.setLumpSumXirrDatas({});
    plotState.setSipXirrDatas({});
    plotState.setXirrError(null);
    try {
      const allNavDatas: Record<string, any[][]> = {}; // key: portfolio index, value: array of nav arrays
      const allNavsFlat: Record<string, any[]> = {}; // for navDatas prop
      for (let pIdx = 0; pIdx < sipPortfolios.length; ++pIdx) {
        const navs: any[][] = [];
        
        // Process assets
        if (sipPortfolios[pIdx].selectedAssets && sipPortfolios[pIdx].selectedAssets.length > 0) {
          for (const asset of sipPortfolios[pIdx].selectedAssets.filter(Boolean)) {
            try {
              let nav: any[] = [];
              let identifier: string = '';
              
              if (asset.type === 'mutual_fund') {
                nav = await loadNavData(asset.schemeCode);
                identifier = `${pIdx}_${asset.schemeCode}`;
              } else if (asset.type === 'index_fund') {
                try {
                  const indexData = await indexService.fetchIndexData(asset.indexName);
                  
                  if (!indexData || indexData.length === 0) {
                    continue;
                  }
                  
                  // Convert index data to NAV format (keep Date objects for fillMissingNavDates)
                  nav = indexData.map(item => ({
                    date: item.date, // Keep as Date object
                    nav: item.nav
                  }));
                  identifier = `${pIdx}_${asset.indexName}`;
                } catch (indexError) {
                  console.error(`Failed to fetch index data for ${asset.indexName}:`, indexError);
                  continue;
                }
              } else if (asset.type === 'yahoo_finance') {
                const stockData = await yahooFinanceService.fetchStockData(asset.symbol);
                
                if (!stockData || stockData.length === 0) {
                  continue;
                }
                
                nav = stockData.map(item => ({
                  date: item.date,
                  nav: item.nav
                }));
                identifier = `${pIdx}_${asset.symbol}`;
              } else if (asset.type === 'fixed_return') {
                try {
                  const fixedReturnData = fixedReturnService.generateFixedReturnData(
                    asset.annualReturnPercentage,
                    1990
                  );
                  
                  if (!fixedReturnData || fixedReturnData.length === 0) {
                    continue;
                  }
                  
                  // Data is already in the correct format
                  nav = fixedReturnData;
                  identifier = `${pIdx}_fixed_${asset.annualReturnPercentage}`;
                } catch (fixedReturnError) {
                  console.error(`Failed to generate fixed return data for ${asset.annualReturnPercentage}%:`, fixedReturnError);
                  continue;
                }
              } else if (asset.type === 'inflation') {
                try {
                  const inflationData = await inflationService.generateInflationNavData(
                    asset.countryCode,
                    1960
                  );
                  
                  if (!inflationData || inflationData.length === 0) {
                    continue;
                  }
                  
                  // Data is already in the correct format
                  nav = inflationData;
                  identifier = `${pIdx}_inflation_${asset.countryCode}`;
                } catch (inflationError) {
                  console.error(`Failed to generate inflation data for ${asset.countryCode}:`, inflationError);
                  continue;
                }
              }
              
              if (!Array.isArray(nav) || nav.length === 0) {
                continue;
              }
              
              const filled = fillMissingNavDates(nav);
              navs.push(filled);
              allNavsFlat[identifier] = filled;
            } catch (error) {
              console.error(`Error fetching data for asset ${asset.name}:`, error);
              throw error;
            }
          }
        }
        allNavDatas[pIdx] = navs;
      }
      plotState.setNavDatas(allNavsFlat);
      // Now calculate XIRR for each portfolio using the worker
      plotState.setLoadingXirr(true);
      const allSipXirrDatas: Record<string, any[]> = {};
      let completed = 0;
      
      for (let pIdx = 0; pIdx < sipPortfolios.length; ++pIdx) {
        const navDataList = allNavDatas[pIdx];
        const allocations = sipPortfolios[pIdx].allocations;
        const rebalancingEnabled = sipPortfolios[pIdx].rebalancingEnabled;
        const rebalancingThreshold = sipPortfolios[pIdx].rebalancingThreshold;
        const stepUpEnabled = sipPortfolios[pIdx].stepUpEnabled;
        const stepUpPercentage = sipPortfolios[pIdx].stepUpPercentage;
        
        if (!navDataList || navDataList.length === 0) {
          allSipXirrDatas[`Portfolio ${pIdx + 1}`] = [];
          completed++;
          continue;
        }
        
        // Check if this portfolio contains inflation asset
        const hasInflation = sipPortfolios[pIdx].selectedAssets.some(
          asset => asset?.type === 'inflation'
        );
        
        const portfolioStartTime = performance.now();
        
        await new Promise<void>((resolve) => {
          const worker = new Worker(new URL('../utils/calculations/sipRollingXirr/worker.ts', import.meta.url));
          // Use 100 as base for XIRR view, actual sipAmount for corpus view
          const baseSipAmount = chartView === 'corpus' ? sipAmount : 100;
          worker.postMessage({ navDataList, years, allocations, rebalancingEnabled, rebalancingThreshold, includeNilTransactions: false, stepUpEnabled, stepUpPercentage, sipAmount: baseSipAmount });
          worker.onmessage = (event: MessageEvent) => {
            const portfolioEndTime = performance.now();
            let resultData = event.data;
            
            // Strip volatility for inflation assets (not meaningful for smooth daily compounding)
            if (hasInflation && Array.isArray(resultData)) {
              resultData = resultData.map((entry: any) => {
                const { volatility, ...rest } = entry;
                return rest;
              });
            }
            
            console.log(`[SIP] Portfolio ${pIdx + 1} total: ${((portfolioEndTime - portfolioStartTime) / 1000).toFixed(2)}s (${resultData.length} data points)`);
            
            allSipXirrDatas[`Portfolio ${pIdx + 1}`] = resultData;
            worker.terminate();
            completed++;
            resolve();
          };
          worker.onerror = (err: ErrorEvent) => {
            allSipXirrDatas[`Portfolio ${pIdx + 1}`] = [];
            worker.terminate();
            completed++;
            resolve();
          };
        });
      }
      plotState.setSipXirrDatas(allSipXirrDatas);
      plotState.setHasPlotted(true);
      plotState.setLoadingNav(false);
      plotState.setLoadingXirr(false);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      if (!(e instanceof Error && errorMsg.includes('Yahoo Finance ticker'))) {
        plotState.setXirrError('Error loading or calculating data: ' + errorMsg);
      }
      console.error('Error loading or calculating data:', e);
      plotState.setLoadingNav(false);
      plotState.setLoadingXirr(false);
    }
  }, [sipPortfolios, years, loadNavData, plotState, sipAmount, chartView]);

  return { handlePlotAllPortfolios };
}

