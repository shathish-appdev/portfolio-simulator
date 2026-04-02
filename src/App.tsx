import { AppNavBar } from "baseui/app-nav-bar";
import { Block } from "baseui/block";
import { ToasterContainer } from "baseui/toast";
import React, { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Container } from "./components/common/Container";
import { HelpDrawer, HelpProvider, useHelp } from "./components/help";
import { BottomBar } from "./components/layout/BottomBar";
import { TabBar } from "./components/layout/TabBar";
import LumpsumSipCompare from './pages/LumpsumSipCompare';
import { StockPriceTab } from "./pages/StockPriceTab";
import { StockSipTab } from "./pages/StockSipTab";
import { StockSwpTab } from "./pages/StockSwpTab";
import { YahooStockPrice } from "./pages/YahooStockPrice";
import { setGlobalOpenHelp } from "./services/yahooFinanceService";
import { trackPageView } from "./utils/analytics";

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { openHelp } = useHelp();

  // Track page view
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  // Register help trigger globally
  useEffect(() => {
    setGlobalOpenHelp(openHelp);
  }, [openHelp]);

  // Active tab detection
  const isStockPriceTab = location.pathname === "/stock-price";
  const isStockSipTab = location.pathname === "/stock-sip";
  const isStockSwpTab = location.pathname === "/stock-swp";
  const isYahooStockPrice = location.pathname === "/yahoo-stock-price";
  const isCompareTab = location.pathname === "/compare";

  return (
    <Container>
      <ToasterContainer autoHideDuration={5000} />

      <AppNavBar
        title="Portfolio Simulator"
        mainItems={[
          { label: "Lumpsum", active: isStockPriceTab },
          { label: "SIP (Stocks)", active: isStockSipTab },
          { label: "SWP (Stocks)", active: isStockSwpTab },
          { label: "Yahoo Prices", active: isYahooStockPrice },
          { label: "Compare", active: isCompareTab },
          { label: "Help", info: { id: "help" } },
        ]}
        onMainItemSelect={(item) => {
          switch (item.label) {
            case "Lumpsum":
              navigate("/stock-price");
              break;
            case "SIP (Stocks)":
              navigate("/stock-sip");
              break;
            case "SWP (Stocks)":
              navigate("/stock-swp");
              break;
            case "Yahoo Prices":
              navigate("/yahoo-stock-price");
              break;
            case "Compare":
              navigate("/compare");
              break;
            case "Help":
              openHelp("getting-started");
              break;
            default:
              break;
          }
        }}
        overrides={{
          Root: {
            style: {
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            },
          },
        }}
      />

      <Block
        position="relative"
        backgroundColor="white"
        padding="1.5rem"
        flex="1"
        display="flex"
        flexDirection="column"
      >
        <TabBar onHelpClick={() => openHelp("getting-started")} />

        {/* Routes */}
        <Routes>
          <Route path="/" element={<Navigate to="/stock-price" replace />} />
          <Route path="/lumpsum" element={<Navigate to="/stock-price" replace />} />
          <Route path="/sip" element={<Navigate to="/stock-price" replace />} />
          <Route path="/historical" element={<Navigate to="/stock-price" replace />} />
          <Route path="/stock-price" element={null} />
          <Route path="/stock-sip" element={null} />
          <Route path="/stock-swp" element={null} />
          <Route path="/yahoo-stock-price" element={null} />
          <Route path="/compare" element={null} />
          <Route path="/portfolio" element={<Navigate to="/stock-price" replace />} />
        </Routes>

        <>
          <Block display={isStockPriceTab ? "block" : "none"} flex="1">
            <StockPriceTab />
          </Block>

          <Block display={isStockSipTab ? "block" : "none"} flex="1">
            <StockSipTab />
          </Block>

          <Block display={isStockSwpTab ? "block" : "none"} flex="1">
            <StockSwpTab />
          </Block>

          <Block display={isYahooStockPrice ? "block" : "none"} flex="1">
            <YahooStockPrice />
          </Block>

          <Block display={isCompareTab ? "block" : "none"} flex="1">
            <LumpsumSipCompare />
          </Block>
        </>
      </Block>

      <BottomBar />

      <HelpDrawer />
    </Container>
  );
};

const App: React.FC = () => {
  return (
    <HelpProvider>
      <AppContent />
    </HelpProvider>
  );
};

export default App;