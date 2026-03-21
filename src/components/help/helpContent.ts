export interface HelpTopic {
  title: string;
  content: string;
}

export const helpContent: Record<string, HelpTopic> = {
  // Getting Started
  'getting-started': {
    title: 'Getting Started',
    content: `A portfolio simulator that lets you compare investments using historical stock and index data from Yahoo Finance.

**Features:**
- **Lumpsum:** Compare one-time investments across two portfolios (e.g., TSLA vs NVDA)
- **SIP (Stocks):** Simulate monthly investments and compare two portfolios
- **SWP (Stocks):** Simulate systematic withdrawals with different strategies

**Use it to:**
- Backtest stock and index investments
- Compare how different portfolios would have performed
- Evaluate withdrawal strategies for retirement or income`,
  },

  'portfolios-assets': {
    title: 'Portfolios & Assets',
    content: `**Portfolio:**
A list of stocks or indices with investment amounts. You can add multiple tickers per portfolio (e.g., Portfolio A: TSLA $5000 + AAPL $5000).

**Comparing portfolios:**
Build Portfolio A and Portfolio B side by side to compare performance. Each appears as a separate line on the chart.

**Ticker format:**
Use Yahoo Finance symbols (e.g., AAPL, TSLA, NVDA, ^GSPC). Indian stocks use .NS (NSE) or .BO (BSE) suffix.

**Synthetic benchmarks:**
Use ~12 for a 12% fixed return, ~TARGET_RATE for 12%, or ~TARGET_RATE:10 for 10% — useful for comparing against a target.`,
  },

  'xirr-explained': {
    title: 'What is XIRR?',
    content: `XIRR (Extended Internal Rate of Return) is the annualized return that accounts for irregular cash flows.

**Why XIRR over CAGR?**
- CAGR works for lumpsum (single investment, single redemption)
- XIRR handles multiple investments at different times (like SIP)

**Example:**
If you invested $10,000/month for 5 years and your corpus is $850,000, XIRR tells you the effective annual return considering each monthly investment date.`,
  },

  'url-sharing': {
    title: 'URL Sharing',
    content: `Your setup (portfolios, tickers, amounts, date range) may be saved to the URL depending on the page.

**How to use:**
- Copy the URL from your browser's address bar
- Share it so others see your exact setup
- Bookmark it to save your analysis for later

No login or account needed.`,
  },

  // Lumpsum (Stocks)
  'lumpsum': {
    title: 'Lumpsum',
    content: `Compare two portfolios of one-time (lumpsum) investments using historical price data.

**How to use:**
1. Add stocks to Portfolio A and/or B (ticker + investment amount)
2. Pick start and end dates
3. Click "Plot"

**Results:**
- **Price Chart:** Raw price over time (start = 1)
- **Portfolio Value Chart:** Total value in $ over time
- **Table:** Investment, units bought, end value, return %, and XIRR (annualized return)

**Synthetic benchmarks:**
Use ~12 for 12% fixed return, ~TARGET_RATE for 12%, or ~TARGET_RATE:10 for 10% — to compare against a target.`,
  },

  // SIP (Stocks)
  'sip-stocks': {
    title: 'SIP (Stocks)',
    content: `Simulate monthly investments into stocks and compare two portfolios.

**How to use:**
1. Add stocks to Portfolio A and/or B (ticker + monthly amount)
2. Select start and end month
3. Click "Plot"

**Results:**
- **Price Chart:** Price over time (start = 1)
- **Portfolio Value Chart:** Cumulative value in $ over time
- **Table:** For each month: price, units bought, accumulated units; final XIRR

**Synthetic benchmarks:**
Use ~12, ~TARGET_RATE, or ~TARGET_RATE:10 to compare against a fixed return target.`,
  },

  // SWP (Stocks)
  'swp-stocks': {
    title: 'SWP (Stocks)',
    content: `Simulate systematic withdrawals from a stock portfolio and compare two withdrawal strategies.

**How to use:**
1. Add a ticker and starting corpus (total amount invested)
2. Define Strategy A and Strategy B:
   - **Fixed $/month:** Withdraw the same amount each month
   - **Fixed $ + growth %/month:** Start with an amount, increase by % each month
   - **% of portfolio/month:** Withdraw a percentage of current value each month
3. Select date range and click "Plot"

**Results:**
- **Portfolio Value Chart:** How your corpus changes over time
- **Withdrawal Chart:** Amount withdrawn each month
- **Table:** Month-by-month breakdown

Useful for retirement planning or evaluating income strategies.`,
  },

  // Supported Assets
  'data-sources': {
    title: 'Data Source',
    content: `**Yahoo Finance:**
All price data comes from [Yahoo Finance](https://finance.yahoo.com). Supports:
- **Stocks:** US (AAPL, TSLA), Indian (TCS.NS, RELIANCE.BO), and global
- **Indices:** ^GSPC (S&P 500), ^NSEI (NIFTY 50), ^IXIC (NASDAQ)
- **ETFs**
- **Commodities:** GC=F (gold), BTC-USD (crypto)

**Synthetic benchmarks:**
Use ~12 for 12% fixed return, ~TARGET_RATE for 12%, or ~TARGET_RATE:10 for 10%. These simulate a hypothetical asset growing at that rate.`,
  },

  'yahoo-tickers': {
    title: 'Common Yahoo Finance Tickers',
    content: `**Indian Stocks:**
TCS.NS -> Tata Consultancy Services (NSE)
RELIANCE.BO -> Reliance Industries (BSE)
HDFCBANK.NS -> HDFC Bank (NSE)

**US Stocks (USD):**
AAPL -> Apple Inc.
TSLA -> Tesla
MSFT -> Microsoft

**Indices:**
^NSEI -> NIFTY 50 (INR)
^BSESN -> SENSEX (INR)
^GSPC -> S&P 500 (USD)
^IXIC -> NASDAQ Composite (USD)
^N225 -> Nikkei 225 (JPY)

**Currency:**
USDINR=X -> USD to INR
EURUSD=X -> Euro to USD

**Crypto:**
BTC-USD -> Bitcoin in USD
ETH-USD -> Ethereum in USD

**Commodities:**
GC=F -> Gold Futures (USD)
GOLDBEES.BO -> Gold ETF (INR)

**Finding tickers:**
Google "[stock/index name] yahoo finance" and use the symbol shown in the page.`,
  },

  // Understanding Charts
  'understanding-charts': {
    title: 'Understanding Charts',
    content: `**Price Chart (normalized):**
Shows price over time with start = 1. Lets you compare growth of different tickers on the same scale.

**Portfolio Value Chart:**
Shows total portfolio value in $ over time. For lumpsum, it's invested amount × price change. For SIP, it adds up units bought each month × current price.

**SWP Withdrawal Chart:**
Shows the amount withdrawn each month under your chosen strategy.`,
  },
};

// Structure for navigation - categories can now be clickable
export const getTopicsByCategory = () => ({
  'Getting Started': {
    topicId: 'getting-started',
    subTopics: ['portfolios-assets', 'xirr-explained', 'url-sharing'],
  },
  'Data Source': {
    topicId: 'data-sources',
    subTopics: ['yahoo-tickers'],
  },
  'Understanding Charts': {
    topicId: 'understanding-charts',
    subTopics: [],
  },
  'Lumpsum': {
    topicId: 'lumpsum',
    subTopics: [],
  },
  'SIP (Stocks)': {
    topicId: 'sip-stocks',
    subTopics: [],
  },
  'SWP (Stocks)': {
    topicId: 'swp-stocks',
    subTopics: [],
  },
});
