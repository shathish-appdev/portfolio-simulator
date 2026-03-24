import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BaseProvider, LightTheme } from 'baseui';
import { StockSipTab } from './StockSipTab';
import { yahooFinanceService } from '../services/yahooFinanceService';

jest.mock('../components/charts/StockPortfolioValueChart', () => ({
  StockPortfolioValueChart: () => <div data-testid="portfolio-value-chart" />,
}));
jest.mock('../components/charts/StockPortfolioValueNormalizedChart', () => ({
  StockPortfolioValueNormalizedChart: () => <div data-testid="portfolio-normalized-chart" />,
}));

const renderWithBaseUI = (ui: React.ReactElement) =>
  render(
    <MemoryRouter initialEntries={['/stock-sip']}>
      <BaseProvider theme={LightTheme}>{ui}</BaseProvider>
    </MemoryRouter>
  );

describe('StockSipTab', () => {
  beforeEach(() => {
    yahooFinanceService.clearCache();
  });

  it('renders both Portfolio A and Portfolio B sections', () => {
    renderWithBaseUI(<StockSipTab />);
    expect(screen.getByText('Portfolio A')).toBeInTheDocument();
    expect(screen.getByText('Portfolio B')).toBeInTheDocument();
  });

  it('shows SIP calculation breakdown table after Plot with synthetic ticker', async () => {
    renderWithBaseUI(<StockSipTab />);
    const tickerA = screen.getAllByPlaceholderText('Ticker (e.g. AAPL, ~12)')[0];
    const amountA = screen.getAllByPlaceholderText('Monthly')[0];
    await userEvent.type(tickerA, '~12');
    await userEvent.type(amountA, '100');
    const plotBtn = screen.getByRole('button', { name: /plot/i });
    await userEvent.click(plotBtn);

    await screen.findByText(/Portfolio A – SIP Calculation Breakdown/);
    expect(screen.getByText(/Per ticker:/)).toBeInTheDocument();
    expect(screen.getByText('Price ($)')).toBeInTheDocument();
    expect(screen.getByText('Month-end price ($)')).toBeInTheDocument();
    expect(screen.getByText('Accumulated Units')).toBeInTheDocument();
  });

  it('does not create duplicate charts when Plot is clicked multiple times', async () => {
    renderWithBaseUI(<StockSipTab />);
    const tickerA = screen.getAllByPlaceholderText('Ticker (e.g. AAPL, ~12)')[0];
    const amountA = screen.getAllByPlaceholderText('Monthly')[0];
    await userEvent.type(tickerA, '~12');
    await userEvent.type(amountA, '100');
    const plotBtn = screen.getByRole('button', { name: /plot/i });

    await userEvent.click(plotBtn);
    await userEvent.click(plotBtn);
    await userEvent.click(plotBtn);

    expect(screen.getAllByTestId('portfolio-value-chart')).toHaveLength(1);
    expect(screen.getAllByTestId('portfolio-normalized-chart')).toHaveLength(1);
  });
});
