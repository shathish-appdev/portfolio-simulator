import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BaseProvider, LightTheme } from 'baseui';
import { StockSwpTab } from './StockSwpTab';
import { yahooFinanceService } from '../services/yahooFinanceService';

jest.mock('../components/charts/StockPortfolioValueChart', () => ({
  StockPortfolioValueChart: ({ series }: { series: { name: string; data: unknown[] }[] }) => (
    <div data-testid="portfolio-chart">{series.map((s) => s.name).join(',')}</div>
  ),
}));

const renderWithBaseUI = (ui: React.ReactElement) =>
  render(
    <MemoryRouter initialEntries={['/stock-swp']}>
      <BaseProvider theme={LightTheme}>{ui}</BaseProvider>
    </MemoryRouter>
  );

describe('StockSwpTab', () => {
  beforeEach(() => {
    yahooFinanceService.clearCache();
  });

  it('renders portfolio section and strategy sections', () => {
    renderWithBaseUI(<StockSwpTab />);
    expect(screen.getByText('Portfolio (shared)')).toBeInTheDocument();
    expect(screen.getByText('Strategy A')).toBeInTheDocument();
    expect(screen.getByText('Strategy B')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /simulate/i })).toBeInTheDocument();
  });

  it('shows portfolio value and withdrawal charts after Simulate with synthetic ticker', async () => {
    renderWithBaseUI(<StockSwpTab />);
    const tickerInput = screen.getByPlaceholderText('Ticker (e.g. VOO, ~12)');
    const corpusInput = screen.getByPlaceholderText('e.g. 100000');
    await userEvent.type(tickerInput, '~12');
    await userEvent.type(corpusInput, '100000');
    const simulateBtn = screen.getByRole('button', { name: /simulate/i });
    await userEvent.click(simulateBtn);

    const charts = await screen.findAllByTestId('portfolio-chart');
    expect(charts).toHaveLength(2); // portfolio value + withdrawal
    expect(charts[0]).toHaveTextContent('Strategy A');
    expect(charts[0]).toHaveTextContent('Strategy B');
  });
});
