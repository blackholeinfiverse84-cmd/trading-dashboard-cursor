import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import PortfolioSelector from '../components/PortfolioSelector';
import { stockAPI, POPULAR_STOCKS, TimeoutError, type PredictionItem } from '../services/api';
import { useConnection } from '../contexts/ConnectionContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { TrendingUp, TrendingDown, IndianRupee, Activity, RefreshCw, AlertCircle, Sparkles, Plus, X, Search, Loader2, Trash2, CheckCircle2, BookOpen } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { formatUSDToINR } from '../utils/currencyConverter';

const DashboardPage = () => {
  const { connectionState } = useConnection();
  const { theme } = useTheme();
  const { portfolioState } = usePortfolio();
  const isLight = theme === 'light';

  // Use portfolio context values instead of local state
  const portfolioValue = portfolioState.totalValue;
  const totalGain = portfolioState.totalGain;
  const totalGainPercent = portfolioState.totalGainPercent;

  // Calculate daily change from portfolio movements
  const [dailyChange, setDailyChange] = useState(0);
  const [dailyChangePercent, setDailyChangePercent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topStocks, setTopStocks] = useState<PredictionItem[]>([]);
  const [userAddedTrades, setUserAddedTrades] = useState<PredictionItem[]>([]);
  const [hiddenTrades, setHiddenTrades] = useState<string[]>([]);
  const [showAddTradeModal, setShowAddTradeModal] = useState(false);
  const [addTradeSymbol, setAddTradeSymbol] = useState('');
  const [addTradeLoading, setAddTradeLoading] = useState(false);
  const [addTradeError, setAddTradeError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ symbol: string, isUserAdded: boolean } | null>(null);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSymbols, setFilteredSymbols] = useState<string[]>([]);
  const [previousPortfolioValue, setPreviousPortfolioValue] = useState<number | null>(null);
  const addTradeInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const prevConnectionStateRef = useRef<boolean>(true);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load user-added trades and hidden trades from localStorage on mount
  useEffect(() => {
    const savedTrades = localStorage.getItem('userAddedTrades');
    if (savedTrades) {
      try {
        const parsed = JSON.parse(savedTrades);
        setUserAddedTrades(parsed);
        console.log('[DashboardPage] Loaded user-added trades from localStorage:', parsed.map((t: PredictionItem) => t.symbol));
      } catch (err) {
        console.error('Failed to load user-added trades:', err);
      }
    }

    const savedHidden = localStorage.getItem('hiddenTrades');
    if (savedHidden) {
      try {
        setHiddenTrades(JSON.parse(savedHidden));
      } catch (err) {
        console.error('Failed to load hidden trades:', err);
      }
    }
  }, []);

  // Track portfolio value changes for daily change calculation
  useEffect(() => {
    if (previousPortfolioValue !== null && previousPortfolioValue > 0) {
      const change = portfolioValue - previousPortfolioValue;
      const changePercent = (change / previousPortfolioValue) * 100;
      setDailyChange(change);
      setDailyChangePercent(changePercent);
    } else if (portfolioValue > 0) {
      // First load - use small estimate
      setDailyChange(portfolioValue * 0.001); // 0.1% estimate
      setDailyChangePercent(0.1);
    }
    setPreviousPortfolioValue(portfolioValue);
  }, [portfolioValue]);

  useEffect(() => {
    let isMounted = true;
    let loadingInProgress = false;
    let lastRefreshTime = 0;
    const REFRESH_INTERVAL = 120000; // 120 seconds (2 minutes) in milliseconds

    // Load data without duplicate connection check
    const loadData = async () => {
      // Prevent multiple simultaneous loads
      if (loadingInProgress) {
        return;
      }

      // Prevent refreshes more frequent than 120 seconds
      const now = Date.now();
      if (now - lastRefreshTime < REFRESH_INTERVAL) {
        console.log(`[Dashboard] Skipping refresh - only ${Math.round((now - lastRefreshTime) / 1000)}s since last refresh`);
        return;
      }

      loadingInProgress = true;
      lastRefreshTime = now;

      // Use connection state from context instead of checking again
      if (!connectionState.isConnected) {
        setError(connectionState.error || 'Backend server is not reachable');
        setLoading(false);
        loadingInProgress = false;
        return;
      }

      // Clear any connection errors if we're connected
      setError((prevError) => {
        if (prevError && (prevError.includes('Unable to connect') || prevError.includes('not reachable') || prevError.includes('not running'))) {
          return null;
        }
        return prevError;
      });

      // If connected, load data directly (no connection check needed)
      try {
        await loadDashboardData();
        // Health check is now handled separately in another useEffect
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to load dashboard data:', err);
        // Don't set error here - let individual load functions handle errors
      } finally {
        loadingInProgress = false;
      }
    };

    // Only re-run if connection state changes from disconnected to connected
    // This prevents unnecessary re-runs when connection state updates but stays the same
    const connectionChanged = prevConnectionStateRef.current !== connectionState.isConnected;
    prevConnectionStateRef.current = connectionState.isConnected;

    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Initial load only if connected or if connection just changed to connected
    if (connectionState.isConnected && (connectionChanged || !refreshIntervalRef.current)) {
      loadData();
    }

    // Refresh every 120 seconds (2 minutes) - only if connected
    if (connectionState.isConnected) {
      refreshIntervalRef.current = setInterval(() => {
        if (!loadingInProgress && isMounted && connectionState.isConnected) {
          loadData();
        }
      }, REFRESH_INTERVAL);
    }

    return () => {
      isMounted = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [connectionState.isConnected]); // Only re-run when connection state actually changes

  // Live time display - updates every second
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every 1 second

    return () => clearInterval(timeInterval);
  }, []);

  // Health check moved to separate useEffect - runs every 5 minutes instead of every refresh
  useEffect(() => {
    const loadHealthStatus = async () => {
      try {
        const health = await stockAPI.health();
        setHealthStatus(health);
      } catch (error) {
        console.error('Failed to load health status:', error);
        // Don't show error - health check is not critical
      }
    };

    // Load once on mount
    loadHealthStatus();

    // Then check every 5 minutes (300000ms) instead of every refresh
    const healthInterval = setInterval(() => {
      loadHealthStatus();
    }, 300000); // 5 minutes = 300000ms

    return () => clearInterval(healthInterval);
  }, []); // Only run once on mount

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    // Show loading state immediately
    setTopStocks([]);
    try {
      // REMOVED: Duplicate connection check - already checked in useEffect
      // This was causing extra API calls and hitting rate limits

      // Load user-added trades, or use default symbols if none exist
      let symbols: string[] = userAddedTrades.map(t => t.symbol);

      // If no user-added trades, load some popular stocks by default
      if (symbols.length === 0) {
        symbols = ['AAPL', 'GOOGL', 'MSFT']; // Default popular stocks
        console.log('[Dashboard] No user-added trades, loading default symbols:', symbols);
      }

      console.log('[Dashboard] Loading predictions for symbols:', symbols);

      // Try predict endpoint with single symbol
      let response;
      try {
        response = await stockAPI.predict(symbols, 'intraday');
      } catch (predictError: unknown) {
        // Handle TimeoutError - backend is still processing, don't show error
        if (predictError instanceof TimeoutError) {
          // Keep loading state active, show processing message
          setError(null); // Clear any previous errors
          // Loading state remains true - backend is still working
          console.log('[Dashboard] Request timed out but backend is still processing:', predictError.message);
          return; // Don't clear loading, don't show error
        }

        // Handle actual errors
        const error = predictError instanceof Error ? predictError : new Error(String(predictError));
        console.error('[Dashboard] Predict error:', error);

        // If connection error, show that
        if (error.message?.includes('Unable to connect') || error.message?.includes('ECONNREFUSED')) {
          setError('Cannot connect to backend server. Please ensure the backend is running on http://127.0.0.1:8000');
          setLoading(false);
          return;
        }

        // For other errors, show error but don't treat as fatal
        setError(error.message || 'Failed to load predictions. Please try again.');
        setLoading(false);
        return;
      }

      // Check for errors in metadata
      if (response.metadata?.error) {
        throw new Error(response.metadata.error);
      }

      // Backend returns: { metadata, predictions }
      // Filter out predictions with errors
      const validPredictions = (response.predictions || []).filter((p: PredictionItem) => !p.error);

      console.log('[Dashboard] API Response:', {
        metadata: response.metadata,
        totalPredictions: response.predictions?.length || 0,
        validPredictions: validPredictions.length,
        firstPrediction: validPredictions[0],
      });

      if (validPredictions.length > 0) {
        // Set initial prediction immediately (fast loading)
        setTopStocks(validPredictions);

        // REMOVED: Background loading of additional symbols to prevent rate limit issues
        // Dashboard now loads only AAPL initially to avoid hitting rate limits
        // User can manually refresh or wait for next auto-refresh to get more symbols
      } else {
        setTopStocks([]);
        if (response.metadata?.count === 0 || validPredictions.length === 0) {
          // Check if there are predictions with errors (indicating training needed)
          const predictionsWithErrors = (response.predictions || []).filter((p: PredictionItem) => p.error);
          if (predictionsWithErrors.length > 0) {
            const errorMsg = predictionsWithErrors[0].error || '';
            if (errorMsg.includes('training') || errorMsg.includes('Model') || errorMsg.includes('model')) {
              // Don't auto-train if rate limited - just show message
              if (errorMsg.includes('Rate limit') || errorMsg.includes('429')) {
                setError('Model needs training, but rate limit reached. Please wait 60 seconds or use the Market Scan page to train models.');
              } else {
                // Only try to train if not rate limited
                const symbolToTrain = symbols[0]; // Train the first symbol
                console.log(`[Dashboard] Attempting to train model for ${symbolToTrain}...`);

                // Show training message
                setError(`Training model for ${symbolToTrain}... This will take 60-90 seconds. The dashboard will refresh automatically when complete.`);

                stockAPI.trainRL(symbolToTrain, 'intraday', 10)
                  .then((trainResult) => {
                    console.log('[Dashboard] Model training completed:', trainResult);
                    // After training completes, reload predictions
                    setTimeout(() => {
                      setError(null); // Clear error message
                      loadDashboardData(); // Reload data
                    }, 2000); // Wait 2 seconds then retry
                  })
                  .catch((trainError: unknown) => {
                    // Handle TimeoutError - training is still in progress
                    if (trainError instanceof TimeoutError) {
                      // Keep loading, show processing message
                      setError(`Training model for ${symbolToTrain}... This will take 60-90 seconds. The dashboard will refresh automatically when complete.`);
                      // Don't clear loading - training is still in progress
                      // Retry after delay to check if training completed
                      setTimeout(() => {
                        loadDashboardData();
                      }, 90000); // Retry after 90 seconds
                      return;
                    }

                    // Handle actual errors
                    const error = trainError instanceof Error ? trainError : new Error(String(trainError));
                    console.error('[Dashboard] Training failed:', error);

                    // If rate limited, don't retry immediately
                    if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
                      setError('Rate limit reached. Please wait 60 seconds before training models. Use the Market Scan page to train models.');
                      setLoading(false);
                    } else {
                      // Other errors
                      setError(`Training failed: ${error.message}. Please use the Market Scan page to train models.`);
                      setLoading(false);
                    }
                  });
              }
            } else {
              // Other error - show it
              setError(errorMsg);
            }
          } else {
            // Don't show error if backend is working but just no predictions yet
            setError(null);
          }
        }
      }

      // Calculate real portfolio metrics from predictions
      if (validPredictions.length > 0) {
        // Calculate total portfolio value (sum of all current prices)
        // Using current_price as the base portfolio value
        const totalValue = validPredictions.reduce((sum: number, pred: PredictionItem) => {
          const price = pred.current_price || 0;
          return sum + price;
        }, 0);

        // Calculate total gain/loss from predicted returns
        const totalReturn = validPredictions.reduce((sum: number, pred: PredictionItem) => {
          const currentPrice = pred.current_price || 0;
          const returnPercent = pred.predicted_return || 0;
          const returnValue = (returnPercent / 100) * currentPrice; // Convert percentage to absolute value
          return sum + returnValue;
        }, 0);

        // Calculate daily change (difference from previous portfolio value)
        if (previousPortfolioValue !== null && previousPortfolioValue > 0) {
          const change = totalValue - previousPortfolioValue;
          const changePercent = (change / previousPortfolioValue) * 100;
          setDailyChange(change);
          setDailyChangePercent(changePercent);
        } else {
          // First load - use average return as daily change estimate
          const avgReturn = validPredictions.length > 0 ? validPredictions.reduce((sum: number, pred: PredictionItem) => {
            return sum + (pred.predicted_return || 0);
          }, 0) / validPredictions.length : 0;
          const estimatedChange = (avgReturn / 100) * totalValue;
          setDailyChange(estimatedChange);
          setDailyChangePercent(avgReturn);
        }

        // Portfolio context handles these calculations now
        // setPortfolioValue, setTotalGain, setTotalGainPercent are managed by PortfolioContext

        console.log('[Dashboard] Portfolio Metrics:', {
          totalValue,
          totalReturn,
          gainPercent: totalValue > 0 ? (totalReturn / totalValue) * 100 : 0,
          predictionsCount: validPredictions.length,
        });
      } else {
        // Portfolio context handles resetting values
      }

      setLastUpdated(new Date());
      setLoading(false); // Clear loading state after successful data load
    } catch (error: unknown) {
      // Handle TimeoutError - backend is still processing
      if (error instanceof TimeoutError) {
        // Keep loading state active, don't show error
        setError(null);
        console.log('[Dashboard] Request timed out but backend is still processing');
        // Don't clear loading state - backend is still working
        return;
      }

      // Handle actual errors
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Failed to load dashboard data:', err);

      if (err.message?.includes('Unable to connect') || err.message?.includes('ECONNREFUSED') || err.message?.includes('Network Error')) {
        // Connection error
        setError(err.message || 'Backend server is not reachable. Please ensure the backend is running.');
      } else if (err.message?.includes('Model training') || err.message?.includes('training')) {
        // Model training needed
        setError(err.message + ' Use the Market Scan page to train models first.');
      } else {
        // Other errors - show but don't treat as fatal
        setError(err.message || 'Failed to load dashboard data. Please try again.');
      }
      setTopStocks([]);
      setLoading(false);
    }
  };

  // Save user-added trades to localStorage
  // Clear all cached trades from localStorage and reload
  const clearCacheAndReload = () => {
    localStorage.removeItem('userAddedTrades');
    localStorage.removeItem('visibleTopStocks');
    setUserAddedTrades([]);
    setTopStocks([]);
    // Portfolio context handles value resets
    setDailyChange(0);
    setDailyChangePercent(0);
    setError('Cache cleared. Add stocks to get started!');
    setTimeout(() => setError(null), 3000);
  };

  const saveUserAddedTrades = (trades: PredictionItem[]) => {
    console.log('[DashboardPage] Saving user-added trades:', trades.map(t => t.symbol));
    setUserAddedTrades(trades);
    localStorage.setItem('userAddedTrades', JSON.stringify(trades));
  };

  // Save hidden trades to localStorage
  const saveHiddenTrades = (symbols: string[]) => {
    setHiddenTrades(symbols);
    localStorage.setItem('hiddenTrades', JSON.stringify(symbols));
  };

  // Normalize symbol for consistent comparison (handle .NS suffix variations)
  const normalizeSymbolForComparison = (symbol: string): string => {
    return symbol.trim().toUpperCase();
  };

  // Check if symbol exists in either user-added or backend stocks (case-insensitive)
  const symbolExistsInTopPerformers = (checkSymbol: string): boolean => {
    const normalized = normalizeSymbolForComparison(checkSymbol);

    // Check in user-added trades
    const inUserTrades = userAddedTrades.some(t =>
      normalizeSymbolForComparison(t.symbol) === normalized
    );

    // Check in backend stocks
    const inBackendStocks = topStocks.some(t =>
      normalizeSymbolForComparison(t.symbol) === normalized
    );

    return inUserTrades || inBackendStocks;
  };

  // Handle search suggestions for add trade
  useEffect(() => {
    if (addTradeSymbol && addTradeSymbol.length > 0) {
      const query = addTradeSymbol.toUpperCase();
      const filtered = POPULAR_STOCKS.filter(symbol =>
        symbol.toUpperCase().includes(query) ||
        symbol.replace('.NS', '').toUpperCase().includes(query)
      ).slice(0, 8); // Show max 8 suggestions
      setFilteredSymbols(filtered);
      setShowSuggestions(filtered.length > 0);
      console.log('[Dashboard] Symbol suggestions:', { query, count: filtered.length, suggestions: filtered });
    } else {
      setFilteredSymbols([]);
      setShowSuggestions(false);
    }
  }, [addTradeSymbol]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        addTradeInputRef.current &&
        !addTradeInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    if (showAddTradeModal) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAddTradeModal]);

  // Add trade to Top Performers
  const handleAddTrade = async () => {
    if (!addTradeSymbol || addTradeSymbol.trim() === '') {
      setAddTradeError('Please enter a symbol');
      return;
    }

    const symbol = addTradeSymbol.trim().toUpperCase();

    // Check if the symbol exactly matches a valid symbol from popular stocks
    const exactMatch = POPULAR_STOCKS.find(s => s.toUpperCase() === symbol);

    // If no exact match and there are filtered suggestions, the input is likely incomplete
    // Check if the input is a substring of any suggestion (like "TATA" for "TATAMOTORS.NS")
    if (!exactMatch && filteredSymbols.length > 0) {
      const isPartialMatch = filteredSymbols.some(s => {
        const sUpper = s.toUpperCase();
        const sWithoutSuffix = sUpper.replace('.NS', '');
        return sUpper.includes(symbol) || sWithoutSuffix.includes(symbol) || symbol.includes(sWithoutSuffix);
      });

      if (isPartialMatch) {
        // Input is a partial match - require user to select from suggestions
        setAddTradeError(`Please select a complete symbol from the suggestions below. "${symbol}" is incomplete.`);
        setShowSuggestions(true);
        return;
      }
    }

    setAddTradeLoading(true);
    setAddTradeError(null);

    try {
      // Log state for debugging
      console.log('[DashboardPage] Add Trade - State Check:', {
        inputSymbol: symbol,
        userAddedTradesCount: userAddedTrades.length,
        userAddedSymbols: userAddedTrades.map(t => t.symbol),
        topStocksCount: topStocks.length,
        topStockSymbols: topStocks.map(t => t.symbol),
        hiddenTrades: hiddenTrades,
      });

      // Check if trade already exists in BOTH user-added trades AND backend stocks (case-insensitive)
      if (symbolExistsInTopPerformers(symbol)) {
        console.log('[DashboardPage] Duplicate found for symbol:', symbol);
        // If it's in userAddedTrades, check if it's hidden - if so, unhide it
        const isInUserTrades = userAddedTrades.some(t => normalizeSymbolForComparison(t.symbol) === symbol);
        if (isInUserTrades && hiddenTrades.includes(symbol)) {
          console.log('[DashboardPage] Found AAPL in userAddedTrades but it\'s hidden - unhiding it');
          setHiddenTrades(hiddenTrades.filter(s => s !== symbol));
          saveHiddenTrades(hiddenTrades.filter(s => s !== symbol));
          setShowAddTradeModal(false);
          setAddTradeSymbol('');
          setAddTradeError(null);
          setAddTradeLoading(false);
          return;
        }
        setAddTradeError('This symbol is already in your Top Performers');
        setAddTradeLoading(false);
        return;
      }

      // Fetch prediction for the symbol
      const response = await stockAPI.predict([symbol], 'intraday');

      if (response.metadata?.error) {
        throw new Error(response.metadata.error);
      }

      const validPredictions = (response.predictions || []).filter((p: PredictionItem) => !p.error);

      if (validPredictions.length === 0) {
        // No predictions found - provide helpful error message with suggestions if available
        if (filteredSymbols.length > 0) {
          const suggestions = filteredSymbols.slice(0, 3).join(', ');
          setAddTradeError(`No predictions found for "${symbol}". Please select a valid symbol from the suggestions: ${suggestions}`);
          setShowSuggestions(true);
        } else {
          setAddTradeError(`No predictions found for "${symbol}". The symbol may not exist or models may need training. Please try a different symbol.`);
        }
        setAddTradeLoading(false);
        return;
      }

      const prediction = validPredictions[0];

      // Add to user-added trades
      const newTrade = {
        ...prediction,
        isUserAdded: true, // Mark as user-added
      };

      const updatedTrades = [...userAddedTrades, newTrade];
      console.log('[DashboardPage] Successfully added trade:', { symbol, newTrade, updatedTradesCount: updatedTrades.length });
      saveUserAddedTrades(updatedTrades);

      // Close modal and reset
      setShowAddTradeModal(false);
      setAddTradeSymbol('');
      setAddTradeError(null);
    } catch (error: any) {
      console.error('Failed to add trade:', error);

      // Handle TimeoutError gracefully - request is still being processed
      if (error instanceof TimeoutError) {
        setAddTradeError('Request is taking longer than expected. The backend is still processing your request. This is normal when models need training (60-90 seconds). Please wait a moment and try again, or check the backend logs.');
      } else {
        setAddTradeError(error.message || 'Failed to fetch prediction for this symbol');
      }
    } finally {
      setAddTradeLoading(false);
    }
  };

  // Remove trade from Top Performers
  const handleRemoveTrade = (symbol: string, isUserAdded: boolean) => {
    if (isUserAdded) {
      // Remove from user-added trades (permanent deletion)
      const updatedTrades = userAddedTrades.filter(t => t.symbol !== symbol);
      saveUserAddedTrades(updatedTrades);
    } else {
      // Hide backend trade (temporary, can be restored by refreshing)
      const updatedHidden = [...hiddenTrades, symbol];
      saveHiddenTrades(updatedHidden);
    }
    setDeleteConfirm(null);
  };

  // Filter out hidden trades
  const visibleTopStocks = topStocks.filter(stock => !hiddenTrades.includes(stock.symbol));

  // Combine backend stocks and user-added trades
  const allTopStocks = [...visibleTopStocks, ...userAddedTrades];

  // Debug logging for data consistency
  React.useEffect(() => {
    if (userAddedTrades.length > 0 || visibleTopStocks.length > 0) {
      console.log('[DashboardPage] Data Summary:', {
        userAddedTradesCount: userAddedTrades.length,
        userAddedSymbols: userAddedTrades.map(t => t.symbol),
        visibleTopStocksCount: visibleTopStocks.length,
        visibleSymbols: visibleTopStocks.map(t => t.symbol),
        totalCount: allTopStocks.length,
        allSymbols: allTopStocks.map(t => t.symbol),
        hiddenTrades: hiddenTrades,
      });
    }
  }, [userAddedTrades, visibleTopStocks, allTopStocks, hiddenTrades]);

  // Generate chart data from top stocks (only real data, no fallback)
  const chartData = allTopStocks.length > 0 ? allTopStocks.map((stock) => ({
    name: stock.symbol,
    value: stock.predicted_price || stock.current_price || 0,
    confidence: (stock.confidence || 0) * 100,
    return: stock.predicted_return || 0,
  })) : [];

  // Calculate real stats from actual data
  const stats = [
    {
      label: 'Portfolio Value',
      value: formatUSDToINR(portfolioValue),
      icon: IndianRupee,
      change: dailyChangePercent >= 0 ? `+${dailyChangePercent.toFixed(2)}%` : `${dailyChangePercent.toFixed(2)}%`,
      changeColor: dailyChangePercent >= 0 ? 'text-green-400' : 'text-red-400',
      bgGradient: 'from-blue-500/20 to-cyan-500/10',
      subtitle: 'Educational Portfolio'
    },
    {
      label: 'Daily Change',
      value: formatUSDToINR(dailyChange),
      icon: Activity,
      change: dailyChangePercent >= 0 ? `+${dailyChangePercent.toFixed(2)}%` : `${dailyChangePercent.toFixed(2)}%`,
      changeColor: dailyChange >= 0 ? 'text-green-400' : 'text-red-400',
      bgGradient: 'from-blue-500/20 to-cyan-500/10'
    },
    {
      label: 'Total Gain',
      value: formatUSDToINR(totalGain),
      icon: TrendingUp,
      change: totalGainPercent >= 0 ? `+${totalGainPercent.toFixed(2)}%` : `${totalGainPercent.toFixed(2)}%`,
      changeColor: totalGain >= 0 ? 'text-green-400' : 'text-red-400',
      bgGradient: 'from-purple-500/20 to-pink-500/10'
    },
  ];

  return (
    <Layout>
      <div className="space-y-3 md:space-y-4 animate-fadeIn w-full relative">
        {/* Added relative for modal positioning */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className={`text-xl md:text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>Dashboard</h1>
              <div className="flex items-center gap-2">
                {connectionState.isConnected ? (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded-lg">
                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                    <span className="text-green-400 text-xs font-medium">Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 border border-red-500/50 rounded-lg">
                    <AlertCircle className="w-3 h-3 text-red-400" />
                    <span className="text-red-400 text-xs font-medium">Offline</span>
                  </div>
                )}
                <div className="hidden md:block">
                  <PortfolioSelector />
                </div>
              </div>
            </div>
            <div className="md:hidden mt-2">
              <PortfolioSelector />
            </div>
            <p className={`text-xs md:text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
              {lastUpdated ? `Updated ${currentTime.toLocaleTimeString()}` : 'Overview of your trading portfolio'}
            </p>
          </div>
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto min-h-[44px] md:min-h-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Connection Error Banner */}
        {error && error.includes('Unable to connect to backend') && (
          <div className={`${isLight ? 'bg-red-50 border-2 border-red-300' : 'bg-red-900/30 border-2 border-red-500/50'} rounded-xl p-4`}>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-400 font-semibold mb-2">Backend Server Not Running</p>
                <p className="text-red-300 text-sm mb-3">{error}</p>
                <div className={`${isLight ? 'bg-gray-100' : 'bg-slate-800/50'} rounded-lg p-3 mt-2`}>
                  <p className={`${isLight ? 'text-gray-700' : 'text-gray-300'} text-xs font-medium mb-1`}>To start the backend server:</p>
                  <code className={`text-xs ${isLight ? 'text-green-700 bg-gray-200' : 'text-green-400 bg-slate-900/50'} block p-2 rounded`}>
                    cd backend && python api_server.py
                  </code>
                  <p className="text-gray-400 text-xs mt-2">
                    Or use the startup script: <code className="text-yellow-400">START_BACKEND_WATCHDOG.bat</code>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}



        {/* General Error Banner */}
        {error && !error.includes('Unable to connect to backend') && (
          <div className={`${isLight ? 'bg-yellow-50 border-2 border-yellow-300' : 'bg-yellow-900/30 border-2 border-yellow-500/50'} rounded-xl p-4`}>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-yellow-400 font-semibold mb-2">Warning</p>
                <p className="text-yellow-300 text-sm">{error}</p>
                <button
                  onClick={loadDashboardData}
                  className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-all hover:scale-105"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards - Full width stacked on mobile, grid on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {loading && topStocks.length === 0 && !error ? (
            [1, 2, 3].map((i) => (
              <div
                key={i}
                className={`${isLight
                  ? 'bg-gray-100 md:bg-gradient-to-br md:from-gray-100 md:to-gray-50 border border-gray-200'
                  : 'bg-slate-800/80 md:bg-gradient-to-br md:from-slate-800/80 md:to-slate-700/50 border border-slate-700/50'
                  } rounded-lg p-4 md:p-6 animate-pulse`}
              >
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div className={`w-10 h-10 md:w-12 md:h-12 ${isLight ? 'bg-gray-300' : 'bg-slate-700'} rounded-lg`}></div>
                  <div className={`w-14 h-5 md:w-16 md:h-6 ${isLight ? 'bg-gray-300' : 'bg-slate-700'} rounded`}></div>
                </div>
                <div className={`w-20 h-3 md:w-24 md:h-4 ${isLight ? 'bg-gray-300' : 'bg-slate-700'} rounded mb-2`}></div>
                <div className={`w-28 h-6 md:w-32 md:h-8 ${isLight ? 'bg-gray-300' : 'bg-slate-700'} rounded`}></div>
              </div>
            ))
          ) : error && error.includes('Unable to connect to backend') ? (
            [1, 2, 3].map((i) => (
              <div
                key={i}
                className={`${isLight ? 'bg-gray-100 border border-gray-200' : 'bg-slate-800/80 border border-slate-700/50'} rounded-lg p-4 md:p-6 opacity-50`}
              >
                <div className="flex items-center justify-center h-full">
                  <p className={`${isLight ? 'text-gray-500' : 'text-gray-500'} text-xs md:text-sm`}>Backend not connected</p>
                </div>
              </div>
            ))
          ) : (
            stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className={`${isLight
                    ? 'bg-white md:bg-gradient-to-br md:from-blue-50 md:to-indigo-50 border border-gray-200'
                    : 'bg-slate-800/80 md:bg-gradient-to-br md:from-green-500/20 md:to-emerald-500/10 border border-slate-700/50'
                    } rounded-lg p-4 md:p-6 shadow-sm`}
                >
                  <div className="flex items-center justify-between mb-2 md:mb-3">
                    <div className={`p-2 ${isLight ? 'bg-blue-100' : 'bg-slate-700/50 md:bg-white/5'} rounded`}>
                      <Icon className={`w-4 h-4 md:w-5 md:h-5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                    </div>
                    <span className={`${stat.changeColor} text-xs md:text-sm font-semibold px-2 py-0.5 md:py-1 rounded ${isLight ? 'bg-gray-100' : 'bg-slate-700/50 md:bg-white/5'}`}>
                      {stat.change}
                    </span>
                  </div>
                  <p className={`${isLight ? 'text-gray-600' : 'text-gray-400'} text-xs md:text-sm mb-1`}>{stat.label}</p>
                  {stat.subtitle && (
                    <p className={`${isLight ? 'text-gray-500' : 'text-gray-500'} text-xs mb-1`}>
                      {stat.subtitle}
                    </p>
                  )}
                  <p className={`text-xl md:text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-white'} leading-tight`}>{stat.value}</p>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-3 md:space-y-4">
          {/* Portfolio Performance Chart - Full width on mobile */}
          <div className={`${isLight ? 'bg-white border border-gray-200' : 'bg-slate-800/80 backdrop-blur-sm border border-slate-700/50'} rounded-lg p-3 md:p-4 shadow-sm w-full`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-base md:text-lg font-semibold ${isLight ? 'text-gray-900' : 'text-white'} flex items-center gap-2`}>
                <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-yellow-400 flex-shrink-0" />
                <span>Portfolio Performance</span>
              </h2>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className={`${isLight ? 'bg-gray-200' : 'bg-slate-700'} h-10 md:h-12 w-full rounded animate-pulse`}></div>
                ))}
              </div>
            ) : chartData.length > 0 ? (
              <div className="w-full" style={{ width: '100%', height: '240px', minWidth: 0, minHeight: '240px' }}>
                <ResponsiveContainer width="100%" height={240} minWidth={0}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={isLight ? "#E5E7EB" : "#374151"}
                      opacity={isLight ? 0.5 : 0.15}
                    />
                    <XAxis
                      dataKey="name"
                      stroke={isLight ? "#6B7280" : "#9CA3AF"}
                      tick={{ fill: isLight ? '#6B7280' : '#9CA3AF', fontSize: 11 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke={isLight ? "#6B7280" : "#9CA3AF"}
                      tick={{ fill: isLight ? '#6B7280' : '#9CA3AF', fontSize: 11 }}
                      tickFormatter={(value) => formatUSDToINR(value > 999 ? value / 1000 : value).replace(/₹/, '₹').slice(0, -3) + (value > 999 ? 'k' : '')}
                      width={55}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isLight ? '#FFFFFF' : '#1E293B',
                        border: isLight ? '1px solid #E5E7EB' : '1px solid #475569',
                        borderRadius: '8px',
                        padding: '10px',
                        fontSize: '12px',
                        color: isLight ? '#111827' : '#E2E8F0'
                      }}
                      labelStyle={{ color: isLight ? '#111827' : '#E2E8F0', fontWeight: 'bold', fontSize: '11px' }}
                      formatter={(value: any) => [formatUSDToINR(Number(value)), 'Value']}
                      cursor={{ stroke: '#3B82F6', strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#3B82F6"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 md:py-12">
                <div className={`${isLight ? 'bg-gray-100' : 'bg-slate-700/50'} rounded-lg p-4 md:p-6`}>
                  <Activity className={`w-10 h-10 md:w-12 md:h-12 mx-auto mb-2 md:mb-3 ${isLight ? 'text-gray-400' : 'text-gray-500'}`} />
                  <p className={`${isLight ? 'text-gray-600' : 'text-gray-400'} text-sm md:text-base mb-2`}>
                    No data available yet
                  </p>
                  <p className={`${isLight ? 'text-gray-500' : 'text-gray-500'} text-xs md:text-sm mb-3`}>
                    Predictions will appear here once loaded
                  </p>
                  <button
                    onClick={() => loadDashboardData()}
                    className="px-3 py-1.5 md:px-4 md:py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs md:text-sm font-medium transition-colors"
                  >
                    <RefreshCw className="w-3 h-3 md:w-4 md:h-4 inline mr-1" />
                    Refresh
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Top Performers */}
          <div className={`${isLight ? 'bg-white border border-gray-200' : 'bg-slate-800/80 backdrop-blur-sm border border-slate-700/50'} rounded-lg p-3 shadow-sm card-hover`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-base md:text-lg font-semibold ${isLight ? 'text-gray-900' : 'text-white'} flex items-center gap-2`}>
                <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-400" />
                Top Performers
                <span className={`text-xs font-normal px-1.5 py-0.5 rounded ${isLight ? 'bg-gray-200 text-gray-700' : 'bg-slate-700 text-slate-300'}`}>
                  {allTopStocks.length}
                </span>
              </h2>
              <button
                onClick={() => {
                  setShowAddTradeModal(true);
                  setAddTradeError(null);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg text-xs md:text-sm font-semibold transition-all active:scale-95 min-h-[36px]"
                title="Add trade to Top Performers"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="skeleton h-16 w-full rounded-lg"></div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <p className="text-red-400 mb-4">{error}</p>
                <button
                  onClick={loadDashboardData}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-all hover:scale-105"
                >
                  Retry
                </button>
              </div>
            ) : allTopStocks.length > 0 ? (
              <div className="space-y-2.5 max-h-[60vh] md:max-h-[70vh] overflow-y-auto custom-scrollbar rounded-lg">
                {allTopStocks.map((stock, index) => {
                  const isPositive = (stock.predicted_return || 0) > 0;
                  const confidence = (stock.confidence || 0) * 100;
                  const isUserAdded = stock.isUserAdded || false;
                  return (
                    <div
                      key={`${stock.symbol}-${index}`}
                      className={`${isLight
                        ? 'bg-gray-50 border border-gray-200 hover:border-blue-400 active:border-blue-500'
                        : 'bg-slate-700/50 border border-slate-600/50 hover:border-blue-500/50 active:border-blue-600/50'
                        } rounded-lg transition-all touch-manipulation shadow-sm`}
                    >
                      {/* Mobile: Stacked layout */}
                      <div className="md:hidden p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-12 h-12 flex-shrink-0 rounded-lg flex items-center justify-center font-bold ${isLight ? 'text-gray-900' : 'text-white'} text-sm ${stock.action === 'LONG' ? (isLight ? 'bg-green-100 border border-green-300' : 'bg-green-500/20 border border-green-500/50') :
                              stock.action === 'SHORT' ? (isLight ? 'bg-red-100 border border-red-300' : 'bg-red-500/20 border border-red-500/50') :
                                (isLight ? 'bg-yellow-100 border border-yellow-300' : 'bg-yellow-500/20 border border-yellow-500/50')
                              }`}>
                              {stock.symbol.slice(0, 2)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <p className={`${isLight ? 'text-gray-900' : 'text-white'} font-bold text-base`}>{stock.symbol}</p>
                                {isUserAdded && (
                                  <span className="text-xs text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">★</span>
                                )}
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${stock.action === 'LONG' ? 'bg-green-500/20 text-green-400' :
                                  stock.action === 'SHORT' ? 'bg-red-500/20 text-red-400' :
                                    'bg-yellow-500/20 text-yellow-400'
                                  }`}>
                                  {stock.action === 'LONG' ? 'BUY' : stock.action === 'SHORT' ? 'SELL' : stock.action || 'HOLD'}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-4 mt-1">
                                <div>
                                  <p className={`${isLight ? 'text-gray-500' : 'text-gray-400'} text-[10px] uppercase font-bold mb-0.5`}>Current</p>
                                  <p className={`${isLight ? 'text-gray-900' : 'text-white'} font-bold text-sm`}>
                                    {formatUSDToINR(stock.current_price || 0, stock.symbol)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={`${isLight ? 'text-gray-500' : 'text-gray-400'} text-[10px] uppercase font-bold mb-0.5`}>Predicted</p>
                                  <p className={`${isLight ? 'text-gray-900' : 'text-white'} font-bold text-sm`}>
                                    {formatUSDToINR(stock.predicted_price || stock.current_price || 0, stock.symbol)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/30">
                                <p className={`${isLight ? 'text-gray-500' : 'text-gray-400'} text-xs font-medium`}>Confidence: {confidence.toFixed(0)}%</p>
                                {stock.predicted_return !== undefined && (
                                  <p className={`text-base font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                    {isPositive ? '+' : ''}{(stock.predicted_return || 0).toFixed(2)}%
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => setDeleteConfirm({ symbol: stock.symbol, isUserAdded })}
                            className="p-2 bg-red-500/20 hover:bg-red-500/30 active:bg-red-500/40 text-red-400 rounded-lg transition-all flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                            title={isUserAdded ? "Delete" : "Hide"}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Desktop: Horizontal layout */}
                      <div className="hidden md:flex items-center justify-between p-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-12 h-12 flex-shrink-0 rounded-lg flex items-center justify-center font-bold ${isLight ? 'text-gray-900' : 'text-white'} text-sm ${stock.action === 'LONG' ? (isLight ? 'bg-green-100 border border-green-300' : 'bg-green-500/20 border border-green-500/50') :
                            stock.action === 'SHORT' ? (isLight ? 'bg-red-100 border border-red-300' : 'bg-red-500/20 border border-red-500/50') :
                              (isLight ? 'bg-yellow-100 border border-yellow-300' : 'bg-yellow-500/20 border border-yellow-500/50')
                            }`}>
                            {stock.symbol.slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`${isLight ? 'text-gray-900' : 'text-white'} font-bold text-sm`}>{stock.symbol}</p>
                              {isUserAdded && (
                                <span className="text-xs text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">★</span>
                              )}
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${stock.action === 'LONG' ? 'bg-green-500/20 text-green-400' :
                                stock.action === 'SHORT' ? 'bg-red-500/20 text-red-400' :
                                  'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                {stock.action === 'LONG' ? 'BUY' : stock.action === 'SHORT' ? 'SELL' : stock.action || 'HOLD'}
                              </span>
                              {stock.horizon && (
                                <span className="text-xs text-gray-400 capitalize">{stock.horizon}</span>
                              )}
                            </div>
                            {stock.predicted_return !== undefined && (
                              <p className={`text-xs font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                {isPositive ? <TrendingUp className="w-3 h-3 inline mr-0.5" /> : <TrendingDown className="w-3 h-3 inline mr-0.5" />}
                                {isPositive ? '+' : ''}{(stock.predicted_return || 0).toFixed(2)}%
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                            <p className={`${isLight ? 'text-gray-500' : 'text-gray-400'} text-[9px] uppercase font-bold tracking-wider`}>Current</p>
                            <p className={`${isLight ? 'text-gray-900' : 'text-white'} font-bold text-sm`}>
                              {formatUSDToINR(stock.current_price || 0, stock.symbol)}
                            </p>
                          </div>
                          <div className="text-right border-l border-slate-700/50 pl-4 min-w-[90px]">
                            <p className={`${isLight ? 'text-gray-500' : 'text-gray-400'} text-[9px] uppercase font-bold tracking-wider`}>Predicted</p>
                            <p className={`${isLight ? 'text-gray-900' : 'text-white'} font-bold text-sm text-blue-400`}>
                              {formatUSDToINR(stock.predicted_price || stock.current_price || 0, stock.symbol)}
                            </p>
                          </div>
                          <div className="text-right border-l border-slate-700/50 pl-4 min-w-[70px]">
                            <p className={`${isLight ? 'text-gray-500' : 'text-gray-400'} text-[9px] uppercase font-bold tracking-wider mb-0.5`}>Confidence</p>
                            <div className="flex items-center gap-1.5 justify-end">
                              <div className={`w-1.5 h-1.5 rounded-full ${confidence > 70 ? 'bg-green-400' :
                                confidence > 50 ? 'bg-yellow-400' :
                                  'bg-red-400'
                                }`}></div>
                              <p className={`text-xs font-semibold ${confidence > 70 ? 'text-green-400' :
                                confidence > 50 ? 'text-yellow-400' :
                                  'text-red-400'
                                }`}>
                                {(confidence || 0).toFixed(0)}%
                              </p>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setDeleteConfirm({ symbol: stock.symbol, isUserAdded })}
                          className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 rounded-lg transition-all hover:scale-110 flex-shrink-0"
                          title={isUserAdded ? "Delete" : "Hide"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Plus className={`w-12 h-12 ${isLight ? 'text-blue-400' : 'text-blue-400'} mx-auto mb-4`} />
                <p className={`${isLight ? 'text-gray-700' : 'text-gray-300'} text-base font-semibold mb-2`}>
                  No stocks selected yet
                </p>
                <p className={`${isLight ? 'text-gray-600' : 'text-gray-400'} text-sm mb-6`}>
                  Add stocks to your dashboard to view predictions and portfolio performance
                </p>
                <button
                  onClick={() => {
                    setShowAddTradeModal(true);
                    setAddTradeError(null);
                    setTimeout(() => addTradeInputRef.current?.focus(), 100);
                  }}
                  className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg font-semibold transition-all active:scale-95 inline-flex items-center gap-2 min-h-[44px]"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add Your First Stock</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
            <div className={`${isLight ? 'bg-white border border-gray-200' : 'bg-slate-800 border border-slate-700'} rounded-xl p-4 sm:p-6 w-full max-w-md animate-fadeIn max-h-[90vh] overflow-y-auto shadow-xl`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-bold ${isLight ? 'text-gray-900' : 'text-white'} flex items-center gap-2`}>
                  <Trash2 className="w-5 h-5 text-red-400" />
                  {deleteConfirm.isUserAdded ? 'Delete Trade' : 'Hide Trade'}
                </h3>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <p className={isLight ? 'text-gray-700' : 'text-gray-300'}>
                  {deleteConfirm.isUserAdded
                    ? `Are you sure you want to permanently delete "${deleteConfirm.symbol}" from Top Performers?`
                    : `Are you sure you want to hide "${deleteConfirm.symbol}" from Top Performers? It will reappear after refresh.`
                  }
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => handleRemoveTrade(deleteConfirm.symbol, deleteConfirm.isUserAdded)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all hover:scale-105"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{deleteConfirm.isUserAdded ? 'Delete' : 'Hide'}</span>
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className={`px-4 py-2.5 ${isLight ? 'bg-gray-200 hover:bg-gray-300 text-gray-800' : 'bg-slate-700 hover:bg-slate-600 text-white'} rounded-lg font-semibold transition-all`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Trade Modal */}
        {showAddTradeModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 xs:p-4 safe-area-inset">
            <div className={`${isLight ? 'bg-white border border-gray-200' : 'bg-slate-800 border border-slate-700'} rounded-xl p-4 xs:p-5 sm:p-6 w-full max-w-md animate-fadeIn max-h-[90vh] mx-auto shadow-xl overflow-hidden flex flex-col`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-bold ${isLight ? 'text-gray-900' : 'text-white'} flex items-center gap-2`}>
                  <Plus className="w-5 h-5 text-blue-400" />
                  Add Trade to Top Performers
                </h3>
                <button
                  onClick={() => {
                    setShowAddTradeModal(false);
                    setAddTradeSymbol('');
                    setAddTradeError(null);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 -mx-2 px-2">
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium ${isLight ? 'text-gray-700' : 'text-gray-300'} mb-2`}>
                      Stock Symbol
                    </label>
                    <div className="relative" ref={suggestionsRef}>
                      <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${isLight ? 'text-gray-500' : 'text-gray-400'} z-10`} />
                      <input
                        ref={addTradeInputRef}
                        type="text"
                        value={addTradeSymbol}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          setAddTradeSymbol(value);
                          setAddTradeError(null);
                        }}
                        onFocus={() => {
                          if (filteredSymbols.length > 0) {
                            setShowSuggestions(true);
                          }
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !addTradeLoading) {
                            setShowSuggestions(false);
                            handleAddTrade();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setShowSuggestions(false);
                          }
                        }}
                        placeholder="e.g., AAPL, TSLA, GOOGL"
                        className={`w-full pl-10 pr-4 py-2.5 ${isLight
                          ? 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-500'
                          : 'bg-slate-700/50 border border-slate-600 text-white placeholder-gray-400'
                          } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                        disabled={addTradeLoading}
                      />

                      {/* Suggestions Dropdown - positioned relative to input, will show above if needed */}
                      {showSuggestions && filteredSymbols.length > 0 && (
                        <div className={`absolute top-full left-0 right-0 mt-1 ${isLight
                          ? 'bg-white border-2 border-gray-300'
                          : 'bg-slate-700 border-2 border-slate-600'
                          } rounded-lg shadow-2xl max-h-60 overflow-y-auto z-[9999]`}>
                          {filteredSymbols.map((suggestionSymbol) => {
                            const isExactMatch = suggestionSymbol.toUpperCase() === addTradeSymbol.toUpperCase();
                            return (
                              <button
                                key={suggestionSymbol}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setAddTradeSymbol(suggestionSymbol.toUpperCase());
                                  setShowSuggestions(false);
                                  setAddTradeError(null);
                                }}
                                className={`w-full px-3 py-2 text-sm text-left transition-colors ${isExactMatch
                                  ? (isLight ? 'bg-blue-100 text-blue-900 font-semibold' : 'bg-blue-600/50 text-white font-semibold')
                                  : (isLight ? 'text-gray-900 hover:bg-gray-100' : 'text-white hover:bg-slate-600')
                                  }`}
                              >
                                {suggestionSymbol}
                                {isExactMatch && ' ✓'}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <p className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'} mt-1`}>
                      Enter a stock symbol to fetch its prediction and add it to Top Performers
                    </p>
                  </div>
                </div>

                {addTradeError && (
                  <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-red-300 text-sm">{addTradeError}</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 xs:gap-3 pt-2">
                  <button
                    onClick={handleAddTrade}
                    disabled={addTradeLoading || !addTradeSymbol.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 min-h-[44px] touch-manipulation"
                  >
                    {addTradeLoading ? (
                      <React.Fragment>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Fetching...</span>
                      </React.Fragment>
                    ) : (
                      <React.Fragment>
                        <Plus className="w-4 h-4" />
                        <span>Add Trade</span>
                      </React.Fragment>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddTradeModal(false);
                      setAddTradeSymbol('');
                      setAddTradeError(null);
                    }}
                    className={`px-4 py-2.5 ${isLight ? 'bg-gray-200 hover:bg-gray-300 text-gray-800' : 'bg-slate-700 hover:bg-slate-600 text-white'} rounded-lg font-semibold transition-all`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className={`${isLight ? 'bg-white border border-gray-200' : 'bg-slate-800/80 backdrop-blur-sm border border-slate-700/50'} rounded-lg p-3 shadow-sm`}>
          <h2 className={`text-sm font-semibold ${isLight ? 'text-gray-900' : 'text-white'} mb-3 flex items-center gap-2`}>
            <Activity className="w-4 h-4 text-blue-400" />
            Recent Activity
          </h2>
          <div className="space-y-2">
            {allTopStocks.slice(0, 3).map((stock, index) => {
              const isPositive = (stock.predicted_return || 0) > 0;
              const actionType = stock.action === 'LONG' ? 'BUY' : stock.action === 'SHORT' ? 'SELL' : 'HOLD';
              return (
                <div
                  key={index}
                  className={`flex items-center justify-between p-2 ${isLight
                    ? 'bg-gray-50 border border-gray-200 hover:border-blue-400'
                    : 'bg-gradient-to-r from-slate-700/50 to-slate-600/30 border border-slate-600/50 hover:border-blue-500/50'
                    } rounded transition-all group shadow-sm`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded ${stock.action === 'LONG' ? (isLight ? 'bg-green-100' : 'bg-green-500/20') :
                      stock.action === 'SHORT' ? (isLight ? 'bg-red-100' : 'bg-red-500/20') :
                        (isLight ? 'bg-yellow-100' : 'bg-yellow-500/20')
                      }`}>
                      {stock.action === 'LONG' ? (
                        <TrendingUp className={`w-4 h-4 ${stock.action === 'LONG' ? (isLight ? 'text-green-600' : 'text-green-400') : (isLight ? 'text-yellow-600' : 'text-yellow-400')}`} />
                      ) : stock.action === 'SHORT' ? (
                        <TrendingDown className={`w-4 h-4 ${isLight ? 'text-red-600' : 'text-red-400'}`} />
                      ) : (
                        <Activity className={`w-4 h-4 ${isLight ? 'text-yellow-600' : 'text-yellow-400'}`} />
                      )}
                    </div>
                    <div>
                      <p className={`${isLight ? 'text-gray-900' : 'text-white'} font-semibold text-sm`}>
                        {actionType} {stock.symbol}
                      </p>
                      <p className={`${isLight ? 'text-gray-600' : 'text-gray-400'} text-xs`}>
                        {formatUSDToINR(stock.predicted_price || stock.current_price || 0, stock.symbol)} •
                        Confidence: {((stock.confidence || 0) * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {stock.predicted_return !== undefined && (
                      <span className={`font-bold text-sm ${isPositive ? (isLight ? 'text-green-600' : 'text-green-400') : (isLight ? 'text-red-600' : 'text-red-400')}`}>
                        {isPositive ? '+' : ''}{stock.predicted_return.toFixed(2)}%
                      </span>
                    )}
                    <p className={`${isLight ? 'text-gray-500' : 'text-gray-400'} text-xs mt-0.5`}>{new Date().toLocaleTimeString()}</p>
                  </div>
                </div>
              );
            })}
            {topStocks.length === 0 && (
              <div className={`text-center py-8 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                <Activity className={`w-12 h-12 mx-auto mb-3 opacity-50 ${isLight ? 'text-gray-400' : 'text-gray-500'}`} />
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout >
  );
};

export default DashboardPage;

