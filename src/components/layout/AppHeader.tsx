import { AppNavBar } from 'baseui/app-nav-bar';
import { useStyletron } from 'baseui';
import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useHelp } from '../help';

/**
 * Top navigation on a light surface so the menu control stays visible on small screens.
 */
export function AppHeader(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { openHelp } = useHelp();
  const [, theme] = useStyletron();

  const isStockPriceTab = location.pathname === '/stock-price';
  const isStockSipTab = location.pathname === '/stock-sip';
  const isStockSwpTab = location.pathname === '/stock-swp';
  const isYahooStockPrice = location.pathname === '/yahoo-stock-price';
  const isWeeklyHighLow = location.pathname === '/weekly-high-low';
  const isCompareTab = location.pathname === '/compare';
  const isNetworthEstimator = location.pathname === '/networth-estimator';

  const overrides = useMemo(
    () => ({
      Root: {
        style: {
          backgroundColor: theme.colors.backgroundSecondary,
          borderBottom: `1px solid ${theme.colors.borderOpaque}`,
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
        },
      },
      AppName: {
        style: {
          color: theme.colors.contentPrimary,
          fontWeight: 700,
          letterSpacing: '-0.03em',
        },
      },
      DesktopMenu: {
        style: {
          alignItems: 'center',
          flexWrap: 'wrap' as const,
          rowGap: theme.sizing.scale200,
        },
      },
      DesktopMenuContainer: {
        style: {
          flexWrap: 'wrap' as const,
          rowGap: theme.sizing.scale200,
        },
      },
      PrimaryMenuContainer: {
        style: {
          flexWrap: 'wrap' as const,
          justifyContent: 'flex-end',
          alignItems: 'center',
          rowGap: theme.sizing.scale200,
          columnGap: theme.sizing.scale100,
          paddingInlineEnd: theme.sizing.scale600,
        },
      },
      MainMenuItem: {
        style: ({ $active }: { $active?: boolean }) => ({
          color: theme.colors.contentPrimary,
          borderBottomWidth: 0,
          borderBottomStyle: 'none',
          marginLeft: theme.sizing.scale300,
          marginRight: theme.sizing.scale300,
          paddingTop: theme.sizing.scale300,
          paddingBottom: theme.sizing.scale300,
          paddingLeft: theme.sizing.scale400,
          paddingRight: theme.sizing.scale400,
          borderRadius: theme.borders.radius300,
          backgroundColor: $active ? theme.colors.backgroundTertiary : 'transparent',
          fontWeight: $active ? 700 : 500,
          boxShadow: $active ? `inset 0 0 0 1px ${theme.colors.borderOpaque}` : 'none',
          ':hover': {
            color: theme.colors.contentPrimary,
            backgroundColor: theme.colors.backgroundTertiary,
          },
        }),
      },
      SideMenuButton: {
        style: {
          color: theme.colors.contentPrimary,
        },
      },
      MobileDrawer: {
        style: {
          backgroundColor: theme.colors.backgroundPrimary,
        },
      },
    }),
    [theme]
  );

  return (
    <AppNavBar
      title="Portfolio Simulator"
      mainItems={[
        { label: 'Lumpsum', active: isStockPriceTab },
        { label: 'SIP (Stocks)', active: isStockSipTab },
        { label: 'SWP (Stocks)', active: isStockSwpTab },
        { label: 'Yahoo Prices', active: isYahooStockPrice },
        { label: 'Weekly High/Low', active: isWeeklyHighLow },
        { label: 'Compare', active: isCompareTab },
        { label: 'Net worth', active: isNetworthEstimator },
        { label: 'Help', info: { id: 'help' } },
      ]}
      onMainItemSelect={(item) => {
        switch (item.label) {
          case 'Lumpsum':
            navigate('/stock-price');
            break;
          case 'SIP (Stocks)':
            navigate('/stock-sip');
            break;
          case 'SWP (Stocks)':
            navigate('/stock-swp');
            break;
          case 'Yahoo Prices':
            navigate('/yahoo-stock-price');
            break;
          case 'Weekly High/Low':
            navigate('/weekly-high-low');
            break;
          case 'Compare':
            navigate('/compare');
            break;
          case 'Net worth':
            navigate('/networth-estimator');
            break;
          case 'Help':
            openHelp('getting-started');
            break;
          default:
            break;
        }
      }}
      overrides={overrides}
    />
  );
}
