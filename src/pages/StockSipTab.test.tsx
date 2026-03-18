import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BaseProvider, LightTheme } from 'baseui';
import { StockSipTab } from './StockSipTab';
import { yahooFinanceService } from '../services/yahooFinanceService';

jest.mock('../components/charts/StockPortfolioValueChart', () => ({ StockPortfolioValueChart: () => null }));
jest.mock('../components/charts/StockPortfolioValueNormalizedChart', () => ({ StockPortfolioValueNormalizedChart: () => null }));

const mockFunds = [{ schemeCode: 1, schemeName: 'Test' }];

const renderWithBaseUI = (ui: React.ReactElement) =>
  render(<BaseProvider theme={LightTheme}>{ui}</BaseProvider>);

describe('StockSipTab', () => {
  beforeEach(() => {
    yahooFinanceService.clearCache();
  });

  it('renders both Portfolio A and Portfolio B sections', () => {
    renderWithBaseUI(<StockSipTab funds={mockFunds} />);
    expect(screen.getByText('Portfolio A')).toBeInTheDocument();
    expect(screen.getByText('Portfolio B')).toBeInTheDocument();
  });

  it('shows SIP calculation breakdown table after Plot with synthetic ticker', async () => {
    renderWithBaseUI(<StockSipTab funds={mockFunds} />);
    const tickerA = screen.getAllByPlaceholderText('Ticker (e.g. AAPL, ~12)')[0];
    const amountA = screen.getAllByPlaceholderText('Monthly')[0];
    await userEvent.type(tickerA, '~12');
    await userEvent.type(amountA, '100');
    const plotBtn = screen.getByRole('button', { name: /plot/i });
    await userEvent.click(plotBtn);

    await screen.findByText(/Portfolio A – SIP Calculation Breakdown/);
    expect(screen.getByText(/Per ticker:/)).toBeInTheDocument();
    expect(screen.getByText('Price ($)')).toBeInTheDocument();
    expect(screen.getByText('Accumulated Units')).toBeInTheDocument();
  });
});
