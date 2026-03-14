import { ProcessedIndexData } from "../types/index";
import { toaster } from "baseui/toast";
import React from "react";

let globalOpenHelp: ((topic: string) => void) | null = null;

export const setGlobalOpenHelp = (openHelp: (topic: string) => void) => {
  globalOpenHelp = openHelp;
};

const showErrorToast = (message: string) => {
  const handleHelpClick = (e: React.MouseEvent) => {
    e.preventDefault();
    globalOpenHelp?.("yahoo-tickers");
  };

  toaster.negative(
    React.createElement(
      "div",
      null,
      message,
      React.createElement("br"),
      React.createElement("br"),
      React.createElement(
        "a",
        {
          href: "#",
          onClick: handleHelpClick,
          style: { color: "white", textDecoration: "underline", cursor: "pointer" },
        },
        "📖 Help?"
      )
    ),
    { autoHideDuration: 7000 }
  );
};

interface YahooFinanceResponse {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        adjclose?: Array<{ adjclose: (number | null)[] }>;
      };
    }>;
    error: any;
  };
}

interface FetchStockDataOptions {
  startDate?: string;
  endDate?: string;
}

class YahooFinanceService {
  private stockDataCache: Record<string, ProcessedIndexData[]> = {};

  async fetchStockData(
    symbol: string,
    options?: FetchStockDataOptions
  ): Promise<ProcessedIndexData[]> {
    const cacheKey = options?.startDate && options?.endDate
      ? `${symbol}_${options.startDate}_${options.endDate}`
      : symbol;
    if (!options?.startDate || !options?.endDate) {
      if (this.stockDataCache[cacheKey]) return this.stockDataCache[cacheKey];
    }

    try {
      let yahooUrl: string;
      if (options?.startDate && options?.endDate) {
        const period1 = Math.floor(new Date(options.startDate + "T00:00:00Z").getTime() / 1000);
        const period2 = Math.floor(new Date(options.endDate + "T23:59:59Z").getTime() / 1000);
        yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${period1}&period2=${period2}`;
      } else {
        yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=100y`;
      }

      const proxyUrl = `https://cors-proxy-lake-omega.vercel.app/api/proxy?url=${encodeURIComponent(
        yahooUrl
      )}`;

      const response = await fetch(proxyUrl);

      if (!response.ok) throw new Error(`Ticker "${symbol}" not found`);

      const yahooData: YahooFinanceResponse = await response.json();

      const chart = yahooData?.chart?.result?.[0];
      if (!chart) throw new Error(`No data for ticker "${symbol}"`);

      const timestamps = chart.timestamp || [];
      const pricesRaw = chart.indicators.adjclose?.[0]?.adjclose || [];

      const processed: ProcessedIndexData[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const price = pricesRaw[i];
        if (price === null || price === undefined) continue;

        const date = new Date(timestamps[i] * 1000);
        processed.push({
          date: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())),
          nav: price,
        });
      }

      if (processed.length < 2) throw new Error(`Not enough valid data for ticker "${symbol}"`);

      if (!options?.startDate || !options?.endDate) {
        this.stockDataCache[cacheKey] = processed;
      }
      return processed;
    } catch (err) {
      const msg = `Error fetching Yahoo Finance ticker "${symbol}"`;
      console.error(msg, err);
      showErrorToast(msg);
      throw err;
    }
  }

  clearCache(): void {
    this.stockDataCache = {};
  }
}

export const yahooFinanceService = new YahooFinanceService();
