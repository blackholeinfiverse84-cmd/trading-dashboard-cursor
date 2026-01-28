import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { stockAPI } from '../services/api';

// Portfolio Types
export type PortfolioType = 'seed' | 'tree' | 'sky' | 'scenario';

export interface PortfolioInfo {
  id: PortfolioType;
  name: string;
  description: string;
  scope: string;
  color: string;
  icon: string;
}

export interface PortfolioHolding {
  symbol: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  value: number;
  stopLossPrice?: number | null;
  side?: 'long' | 'short';
}

export interface PortfolioState {
  selectedPortfolio: PortfolioType;
  holdings: PortfolioHolding[];
  totalValue: number;
  totalGain: number;
  totalGainPercent: number;
  lastUpdated: Date | null;
}

interface PortfolioContextType {
  // State
  portfolioState: PortfolioState;
  availablePortfolios: PortfolioInfo[];
  isLoading: boolean;
  error: string | null;

  // Actions
  selectPortfolio: (portfolioId: PortfolioType) => void;
  addHolding: (holding: Omit<PortfolioHolding, 'currentPrice' | 'value'>) => Promise<void>;
  removeHolding: (symbol: string) => void;
  updateHoldingPrice: (symbol: string, newPrice: number) => void;
  refreshPortfolio: () => Promise<void>;
  clearPortfolio: () => void;
  updateHoldingStopLoss: (symbol: string, stopLossPrice: number | null) => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

// Portfolio Definitions
export const PORTFOLIO_DEFINITIONS: Record<PortfolioType, PortfolioInfo> = {
  seed: {
    id: 'seed',
    name: 'Seed Portfolio',
    description: 'Beginner Learning',
    scope: 'Small positions to understand basic concepts',
    color: 'from-green-500 to-emerald-500',
    icon: '🌱'
  },
  tree: {
    id: 'tree',
    name: 'Tree Portfolio',
    description: 'Practice & Discipline',
    scope: 'Medium complexity for behavioral learning',
    color: 'from-blue-500 to-cyan-500',
    icon: '🌳'
  },
  sky: {
    id: 'sky',
    name: 'Sky Portfolio',
    description: 'Advanced Analysis',
    scope: 'Complex positions for multi-factor analysis',
    color: 'from-purple-500 to-pink-500',
    icon: '🌤️'
  },
  scenario: {
    id: 'scenario',
    name: 'Scenario Portfolio',
    description: 'What-if Simulation',
    scope: 'Hypothetical situations for stress testing',
    color: 'from-orange-500 to-red-500',
    icon: '🔮'
  }
};

export const PortfolioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedPortfolio, setSelectedPortfolio] = useState<PortfolioType>('seed');
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [totalGain, setTotalGain] = useState(0);
  const [totalGainPercent, setTotalGainPercent] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);

  // Load portfolio data from localStorage on mount
  useEffect(() => {
    loadPortfolioFromStorage(selectedPortfolio);
  }, [selectedPortfolio]);

  const loadPortfolioFromStorage = (portfolioId: PortfolioType) => {
    try {
      const key = `portfolio_${portfolioId}_holdings`;
      const savedHoldings = localStorage.getItem(key);

      if (savedHoldings) {
        const parsedHoldings: PortfolioHolding[] = JSON.parse(savedHoldings);
        setHoldings(parsedHoldings);
        calculatePortfolioMetrics(parsedHoldings);
      } else {
        setHoldings([]);
        setTotalValue(0);
        setTotalGain(0);
        setTotalGainPercent(0);
      }
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load portfolio:', err);
      setError('Failed to load portfolio data');
    }
  };

  const savePortfolioToStorage = (portfolioId: PortfolioType, holdingsToSave: PortfolioHolding[]) => {
    try {
      const key = `portfolio_${portfolioId}_holdings`;
      localStorage.setItem(key, JSON.stringify(holdingsToSave));
    } catch (err) {
      console.error('Failed to save portfolio:', err);
      setError('Failed to save portfolio data');
    }
  };

  const calculatePortfolioMetrics = (holdingsToCalculate: PortfolioHolding[]) => {
    const total = holdingsToCalculate.reduce((sum, h) => sum + h.value, 0);
    const gain = holdingsToCalculate.reduce((sum, h) => sum + (h.currentPrice - h.avgPrice) * h.shares, 0);

    setTotalValue(total);
    setTotalGain(gain);
    setTotalGainPercent(total > 0 ? (gain / total) * 100 : 0);
  };

  const selectPortfolio = (portfolioId: PortfolioType) => {
    setSelectedPortfolio(portfolioId);
    // Will trigger useEffect to load the selected portfolio
  };

  const addHolding = async (holding: Omit<PortfolioHolding, 'currentPrice' | 'value'>) => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch current price from backend using stockAPI
      const data = await stockAPI.predict([holding.symbol], 'intraday');

      let currentPrice = holding.avgPrice;
      if (data.predictions && data.predictions.length > 0) {
        const prediction = data.predictions.find((p: any) => !p.error);
        if (prediction) {
          currentPrice = prediction.predicted_price || prediction.current_price || holding.avgPrice;
        }
      }

      const newHolding: PortfolioHolding = {
        ...holding,
        currentPrice,
        value: holding.shares * currentPrice,
        stopLossPrice: holding.stopLossPrice || null,
        side: holding.side || 'long'
      };

      const updatedHoldings = [...holdings, newHolding];
      setHoldings(updatedHoldings);
      savePortfolioToStorage(selectedPortfolio, updatedHoldings);
      calculatePortfolioMetrics(updatedHoldings);
      setLastUpdated(new Date());

    } catch (err) {
      console.error('Failed to add holding:', err);
      setError('Failed to fetch current price. Using average price.');

      // Fallback: use average price
      const newHolding: PortfolioHolding = {
        ...holding,
        currentPrice: holding.avgPrice,
        value: holding.shares * holding.avgPrice,
        stopLossPrice: holding.stopLossPrice || null,
        side: holding.side || 'long'
      };

      const updatedHoldings = [...holdings, newHolding];
      setHoldings(updatedHoldings);
      savePortfolioToStorage(selectedPortfolio, updatedHoldings);
      calculatePortfolioMetrics(updatedHoldings);
      setLastUpdated(new Date());
    } finally {
      // Ensure loading state is only reset after a reasonable delay to prevent flickering
      setTimeout(() => {
        setIsLoading(false);
      }, 300); // Small delay to prevent rapid state changes
    }
  };

  const removeHolding = (symbol: string) => {
    const updatedHoldings = holdings.filter(h => h.symbol !== symbol);
    setHoldings(updatedHoldings);
    savePortfolioToStorage(selectedPortfolio, updatedHoldings);
    calculatePortfolioMetrics(updatedHoldings);
    setLastUpdated(new Date());
  };

  const updateHoldingPrice = (symbol: string, newPrice: number) => {
    const updatedHoldings = holdings.map(h =>
      h.symbol === symbol
        ? { ...h, currentPrice: newPrice, value: h.shares * newPrice }
        : h
    );
    setHoldings(updatedHoldings);
    savePortfolioToStorage(selectedPortfolio, updatedHoldings);
    calculatePortfolioMetrics(updatedHoldings);
  };

  const refreshPortfolio = async () => {
    const now = Date.now();
    // Prevent refresh if last refresh was less than 1 second ago to avoid rapid state changes
    if (now - lastRefreshTime < 1000) {
      return;
    }

    setLastRefreshTime(now);
    setIsLoading(true);
    setError(null);

    try {
      // Refresh all holdings with current prices
      const symbols = holdings.map(h => h.symbol);
      if (symbols.length === 0) {
        // Even if no holdings, still use timeout to prevent rapid state changes
        setTimeout(() => {
          setIsLoading(false);
        }, 300);
        return;
      }


      const data = await stockAPI.predict(symbols, 'intraday');

      if (data.predictions) {
        const updatedHoldings = holdings.map(holding => {
          const prediction = data.predictions.find((p: any) => p.symbol === holding.symbol && !p.error);
          if (prediction) {
            const newPrice = prediction.predicted_price || prediction.current_price || holding.currentPrice;
            return {
              ...holding,
              currentPrice: newPrice,
              value: holding.shares * newPrice,
              stopLossPrice: holding.stopLossPrice,
              side: holding.side
            };
          }
          return holding;
        });

        setHoldings(updatedHoldings);
        savePortfolioToStorage(selectedPortfolio, updatedHoldings);
        calculatePortfolioMetrics(updatedHoldings);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to refresh portfolio:', err);
      setError('Failed to refresh portfolio prices');
    } finally {
      // Ensure loading state is only reset after a reasonable delay to prevent flickering
      setTimeout(() => {
        setIsLoading(false);
      }, 300); // Small delay to prevent rapid state changes
    }
  };

  const clearPortfolio = () => {
    setHoldings([]);
    setTotalValue(0);
    setTotalGain(0);
    setTotalGainPercent(0);
    setLastUpdated(new Date());
    savePortfolioToStorage(selectedPortfolio, []);
  };

  const updateHoldingStopLoss = (symbol: string, stopLossPrice: number | null) => {
    const updatedHoldings = holdings.map(h =>
      h.symbol === symbol
        ? { ...h, stopLossPrice: stopLossPrice || null }
        : h
    );
    setHoldings(updatedHoldings);
    savePortfolioToStorage(selectedPortfolio, updatedHoldings);
    calculatePortfolioMetrics(updatedHoldings);
  };

  const portfolioState: PortfolioState = {
    selectedPortfolio,
    holdings,
    totalValue,
    totalGain,
    totalGainPercent,
    lastUpdated
  };

  const value: PortfolioContextType = {
    portfolioState,
    availablePortfolios: Object.values(PORTFOLIO_DEFINITIONS),
    isLoading,
    error,
    selectPortfolio,
    addHolding,
    removeHolding,
    updateHoldingPrice,
    refreshPortfolio,
    clearPortfolio,
    updateHoldingStopLoss
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = (): PortfolioContextType => {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
};