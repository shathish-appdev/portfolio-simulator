export interface HelpTopic {
  title: string;
  content: string;
}

export const helpContent: Record<string, HelpTopic> = {
  // Getting Started
  'getting-started': {
    title: 'Getting Started',
    content: `An investment analysis tool for Indian markets that lets you simulate and compare investment portfolios using historical data.

**Features:**
- Lumpsum investment simulation
- SIP (Systematic Investment Plan) simulation
- Historical NAV comparison

**Use it to:**
- Backtest investment portfolios
- Compare assets (mutual funds, indices, etc.)
- Understand rolling returns and volatility`,
  },

  'portfolios-assets': {
    title: 'Portfolios & Assets',
    content: `**Asset:**
A single investable asset — a mutual fund, an index, a stock, etc.

**Portfolio:**
A combination of one or more assets with allocation percentages.

**Examples:**
- Single-asset portfolio: 100% NIFTY 50
- Multi-asset portfolio: 70% Equity Fund + 30% Debt Fund

**Why portfolios?**
You can compare different approaches side by side:
- Portfolio 1: Pure equity (100% NIFTY 50)
- Portfolio 2: Balanced (70% equity + 30% debt)
- Portfolio 3: Diversified (60% equity + 30% debt + 10% gold)

Each portfolio appears as a separate line on the chart.

**Important:** Allocations within a portfolio must add up to exactly 100%. The app shows a warning if they don't.`,
  },

  'xirr-explained': {
    title: 'What is XIRR?',
    content: `XIRR (Extended Internal Rate of Return) is the annualized return that accounts for irregular cash flows.

**Why XIRR over CAGR?**
- CAGR works for lumpsum (single investment, single redemption)
- XIRR handles multiple investments at different times (like SIP)

**Example:**
If you invested ₹10,000/month for 5 years and your corpus is ₹8,50,000, XIRR tells you the effective annual return considering each monthly investment date.`,
  },

  'why-rolling': {
    title: 'Why Rolling Returns?',
    content: `Most websites show only a few return values: 1Y, 3Y, 5Y returns from today.

**The problem:**
These are just single data points. An asset showing 15% 5Y return today might have shown 8% last year and 22% the year before. You're seeing a snapshot, not the full picture.

**Rolling returns show everything:**
Instead of one 5-year return, you see ALL possible 5-year returns the asset has generated. Every point on the chart is a return for a different start date.

**What you can learn:**
- **Consistency:** Is the asset reliably good, or just lucky timing?
- **Range:** What's the best and worst case?
- **Probability:** How often did the asset beat X%?

**Example:**
An asset's 5Y return today is 12%. But rolling returns show it ranged from 6% to 18% over the last decade. Now you know what to realistically expect.`,
  },

  'url-sharing': {
    title: 'URL Sharing',
    content: `Your entire setup is automatically saved to the URL.

**What's saved:**
- All portfolios and their assets
- Allocation percentages
- Investment amount and duration
- Settings like step-up, rebalancing, log scale

**How to use:**
- Just copy the URL from your browser's address bar
- Share it with anyone — they'll see your exact setup
- Bookmark it to save your analysis for later

No login or account needed. The URL is your saved state.`,
  },

  // Lumpsum Simulator
  'lumpsum-simulator': {
    title: 'Lumpsum Simulator',
    content: `Simulates a one-time investment over historical periods.

**How to use:**
1. Add portfolios (each can have multiple assets with allocations)
2. Select assets (mutual funds, indices, etc.)
3. Set investment amount and period (years)
4. Click "Plot" to see results

**Reading the chart (example: 3-year, point on 10-Jan-2023):**
You invested ₹x once on 10-Jan-2020.
- **XIRR View:** Point = annualized return (CAGR) for this period
- **Corpus View:** Point = final portfolio value in ₹

Shows all possible returns/values for any 3-year lumpsum in this portfolio.

**Multi-asset portfolios:**
Allocate across multiple assets (e.g., 70% equity, 30% debt) to see combined performance.

**Transaction Details:**
Click any point on the chart to see the complete transaction history — every buy with date, NAV, units, and amount.`,
  },

  // SIP Simulator
  'sip-simulator': {
    title: 'SIP Simulator',
    content: `Simulates monthly SIP investments over historical periods.

**How to use:**
1. Add portfolios with asset allocations
2. Enable step-up or rebalancing if needed
3. Select period and click "Plot"

**Reading the chart (example: 3-year, point on 10-Jan-2023):**
You invested ₹x monthly from 10-Jan-2020 to 10-Dec-2022 (36 investments).
- **XIRR View:** Point = XIRR return of this SIP
- **Corpus View:** Point = final portfolio value in ₹

Shows all possible returns/values for any 3-year SIP in this portfolio.

**Multi-asset SIP:**
Your monthly amount is split across assets based on allocation percentages.

**Transaction Details:**
Click any point on the chart to see complete transaction history — all monthly investments, rebalances (if enabled), with dates, NAV, units, and amounts.`,
  },

  'sip-stepup': {
    title: 'Step-up SIP',
    content: `Increases your monthly SIP amount by a fixed percentage every year.

**Example (10% step-up, SIP started 15-Mar-2020):**
- Mar 2020 to Feb 2021: ₹10,000/month
- Mar 2021 to Feb 2022: ₹11,000/month (increased on 15-Mar-2021)
- Mar 2022 to Feb 2023: ₹12,100/month (increased on 15-Mar-2022)

Step-up kicks in on each year anniversary of your SIP start date.

**Why use it?**
- Matches income growth
- Accelerates wealth building
- Combats inflation`,
  },

  'sip-rebalancing': {
    title: 'Rebalancing',
    content: `Rebalancing restores your portfolio to target allocations when they drift beyond a threshold.

**When does it happen?**
Checked on each SIP date (monthly), after your regular SIP investment is made.

**Order of operations on each SIP date:**
1. Regular SIP buy happens first (split by allocation %)
2. Portfolio is checked for drift
3. If any asset drifts beyond threshold → rebalance triggers

**Example (70:30 target, 5% threshold):**
- After SIP, equity is at 76%, debt at 24%
- Drift = 6% (exceeds 5% threshold)
- System sells equity, buys debt to restore 70:30

**Note:**
Only relevant for multi-asset portfolios. Disabled for single-asset portfolios.`,
  },

  // Historical Values
  'historical-values': {
    title: 'Historical Values',
    content: `View and compare historical NAV of assets on a single chart.

**Use it to:**
- Check raw NAV values of any asset
- Find when an asset started (first available date)
- Compare growth of multiple assets over time

**How to use:**
1. Add assets you want to view/compare
2. Select asset type and specific asset
3. Click "Plot"`,
  },

  // Supported Assets
  'data-sources': {
    title: 'Supported Assets',
    content: `**Mutual Funds:**
All AMFI-registered Indian mutual funds.
Source: [MFAPI](https://mfapi.in), updated daily.

**Index Funds:**
NIFTY 50, SENSEX, and other indices.
Primary source: [NSE India](https://www.niftyindices.com/reports/historical-data). Since the official site can sometimes be unreliable, index data is periodically backed up to [this repository](https://github.com/asrajavel/mf-index-data) (updated quarterly). We read from this backup, so you might not see the latest data.

**Yahoo Finance:**
Any ticker available on Yahoo Finance — stocks, global indices, ETFs.

**Fixed Return:**
Synthetic benchmark showing a fixed annual return (e.g., 8% p.a.).
Useful for comparing against guaranteed return assets.

**Inflation:**
CPI-based data showing how money loses value over time.
Source: [World Bank](https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG?locations=IN) (Consumer Price Index).
Use to understand real (inflation-adjusted) returns.

---

Note: NAV data is only available on trading days. For weekends/holidays, the next available NAV is used to fill the gap, ensuring continuous date coverage for calculations.`,
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

  // Understanding Charts section
  'understanding-charts': {
    title: 'Understanding Charts',
    content: `The simulators generate several charts to help you analyze performance. These charts work the same for both Lumpsum and SIP.

**Rolling Returns Chart:**
Shows returns for every possible investment window. Each point = return if you ended on that date.

**Distribution Histogram:**
Groups rolling returns into 20 buckets. Shows what % of returns fell in each range (per portfolio).

**Volatility Chart:**
Shows annualized volatility (%) for each rolling period — how risky the investment was.`,
  },

  'rolling-xirr': {
    title: 'Rolling Returns Chart',
    content: `Shows returns for every possible investment window of the selected duration.

**What each point means:**
"If my investment ended on this date after X years, what would my return be?"

**What to look for:**
- **Consistency:** Flat line = stable returns across time
- **Range:** Gap between best and worst = risk indicator
- **Trends:** Upward/downward patterns over market cycles

Helps answer: "What's the probability of achieving X% returns?"`,
  },

  'histogram': {
    title: 'Distribution Histogram',
    content: `Groups all rolling returns into 20 buckets and shows what percentage fell in each range.

**How to read it:**
- X-axis: Return ranges (buckets are auto-calculated based on min/max)
- Y-axis: Percentage of returns in that range
- For each portfolio, its bars add up to 100%
- Taller bar = more common outcome for that portfolio

**What to look for:**
- **Peak location:** Where most returns cluster (expected outcome)
- **Spread:** Wide = unpredictable, narrow = consistent
- **Left tail:** What % of returns were negative/low

**Example:**
If Portfolio A's 10-12% bar shows 25%, it means 25% of all historical returns for Portfolio A fell in 10-12%.

**Note:** The distribution is only meaningful if you have enough data points. If the date range is short, you'll have fewer rolling periods, making the distribution less reliable. For example, a 5-year rolling analysis on 6 years of data gives very few data points.`,
  },

  'volatility': {
    title: 'Volatility Chart',
    content: `Shows annualized volatility (%) for each rolling period — a measure of risk.

**How it's calculated:**
1. Take daily portfolio values during the investment period
2. Calculate daily returns (% change each day)
3. On SIP days, cash flow is excluded so only market movement counts
4. Weekends/holidays are skipped (no artificial zero returns)
5. Standard deviation of daily returns × √(~252 trading days/year) = annualized volatility

**What each point means:**
"If my investment ended on this date, how volatile was the ride?"

**Reading the chart:**
- Higher % = more volatile = riskier
- Lower % = steadier = less risky
- Compare portfolios to see which had a smoother ride

**Use it to:**
- Understand the risk you'd have experienced
- Compare risk profiles of different portfolios
- See if volatility changed over market cycles`,
  },
};

// Structure for navigation - categories can now be clickable
export const getTopicsByCategory = () => ({
  'Getting Started': {
    topicId: 'getting-started',
    subTopics: ['portfolios-assets', 'xirr-explained', 'why-rolling', 'url-sharing'],
  },
  'Supported Assets': {
    topicId: 'data-sources',
    subTopics: ['yahoo-tickers'],
  },
  'Understanding Charts': {
    topicId: 'understanding-charts',
    subTopics: ['rolling-xirr', 'histogram', 'volatility'],
  },
  'Lumpsum Simulator': {
    topicId: 'lumpsum-simulator',
    subTopics: [],
  },
  'SIP Simulator': {
    topicId: 'sip-simulator',
    subTopics: ['sip-stepup', 'sip-rebalancing'],
  },
  'Historical Values': {
    topicId: 'historical-values',
    subTopics: [],
  },
});
