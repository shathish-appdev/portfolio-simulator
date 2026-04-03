/**
 * Split one comma-separated segment from portfolio URL params (`pa`, `pb`, `p`, `corpus`, …).
 * Uses the **last** colon as the ticker/amount boundary so synthetic tickers like
 * `~TARGET_RATE:10` work: `~TARGET_RATE:10:5000` → ticker `~TARGET_RATE:10`, amount `5000`.
 */
export function splitTickerAmountSegment(part: string): { ticker: string; amount: string } {
  const trimmed = part.trim();
  if (!trimmed) return { ticker: '', amount: '' };
  const lastColon = trimmed.lastIndexOf(':');
  if (lastColon === -1) return { ticker: trimmed, amount: '' };
  return {
    ticker: trimmed.slice(0, lastColon).trim(),
    amount: trimmed.slice(lastColon + 1).trim(),
  };
}
