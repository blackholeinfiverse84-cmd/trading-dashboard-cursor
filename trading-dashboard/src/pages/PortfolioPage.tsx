import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import PortfolioSelector from '../components/PortfolioSelector';
import { usePortfolio } from '../contexts/PortfolioContext';
import { useNotification } from '../contexts/NotificationContext';
import { stockAPI, TimeoutError, type PredictionItem } from '../services/api';
import { TrendingUp, TrendingDown, Plus, AlertTriangle, CheckCircle, BookOpen, RotateCcw, Info } from 'lucide-react';
import { formatUSDToINR } from '../utils/currencyConverter';
import testResponsiveDesign from '../utils/testResponsive';
import { config } from '../config';

const PortfolioPage = () => {
  const { showNotification } = useNotification();
  const {
    portfolioState,
    availablePortfolios,
    isLoading,
    error,
    addHolding,
    removeHolding,
    refreshPortfolio,
    clearPortfolio,
    updateHoldingStopLoss
  } = usePortfolio();

  const [showAddModal, setShowAddModal] = useState(false);
  const [newPosition, setNewPosition] = useState({ symbol: '', shares: 0, avgPrice: 0 });
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Risk assessment state
  const [riskAssessment, setRiskAssessment] = useState<any>(null);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [riskChecking, setRiskChecking] = useState(false);
  const [riskError, setRiskError] = useState<string | null>(null);
  const [pendingTrade, setPendingTrade] = useState<any>(null);
  // Stop-loss state
  const [stopLossPrice, setStopLossPrice] = useState<number>(0);
  const [stopLossError, setStopLossError] = useState<string | null>(null);

  // Calculate risk percentage
  const calculateRiskPercentage = (entryPrice: number, stopLossPrice: number, quantity: number, portfolioValue: number) => {
    const riskPerUnit = Math.abs(entryPrice - stopLossPrice);
    const totalRisk = riskPerUnit * quantity;
    const riskPercent = (totalRisk / portfolioValue) * 100;
    return { riskPerUnit, totalRisk, riskPercent };
  };

  // Available stocks list - US + Indian stocks
  const availableStocks = [
    // US Stocks
    'AAPL', 'GOOGL', 'MSFT', 'TSLA', 'META', 'AMZN', 'NVDA', 'AMD', 'INTC', 'NFLX',
    'IBM', 'ORACLE', 'CISCO', 'UBER', 'COIN', 'PYPL', 'SHOP', 'SQ', 'DDOG', 'NET',
    // Indian Stocks - Banking & Finance
    'SBIN.NS', 'AXISBANK.NS', 'ICICIBANK.NS', 'KOTAKBANK.NS', 'HDFC.NS', 'BAJAJFINSV.NS',
    // Indian Stocks - IT & Tech
    'TCS.NS', 'INFY.NS', 'WIPRO.NS', 'HCLTECH.NS', 'TECHM.NS',
    // Indian Stocks - Automobiles
    'TATAMOTORS.NS', 'M&M.NS', 'MARUTI.NS', 'BAJAJ-AUTO.NS', 'EICHERMOT.NS',
    // Indian Stocks - Steel & Metal
    'TATASTEEL.NS', 'JSWSTEEL.NS', 'HINDALCO.NS', 'NMDC.NS',
    // Indian Stocks - Energy
    'GAIL.NS', 'POWERGRID.NS', 'NTPC.NS', 'COAL.NS', 'BPCL.NS',
    // Indian Stocks - Infrastructure & Transport
    'ADANIPORTS.NS', 'ADANIGREEN.NS', 'ADANITRANS.NS', 'LT.NS',
    // Indian Stocks - Consumer & Others
    'ASIANPAINT.NS', 'ULTRACEMCO.NS', 'SUNPHARMA.NS', 'NESTLEIND.NS', 'BRITANNIA.NS',
    'HINDUNILVR.NS', 'ITC.NS'
  ];

  const handleSymbolInput = (value: string) => {
    const upperValue = value.toUpperCase();
    setNewPosition({ ...newPosition, symbol: upperValue });

    // Filter suggestions based on input
    if (upperValue.length > 0) {
      const filtered = availableStocks.filter(stock =>
        stock.includes(upperValue)
      );
      setSuggestions(filtered.slice(0, 6)); // Show max 6 suggestions
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (symbol: string) => {
    setNewPosition({ ...newPosition, symbol });
    setSuggestions([]);
  };

  useEffect(() => {
    // Portfolio data is automatically managed by the PortfolioContext
    // No need to manually load here since context handles it
    // Just trigger a refresh to ensure fresh data
    refreshPortfolio();

    // Run responsive design tests
    testResponsiveDesign();

    // Refresh every 120 seconds (2 minutes) to reduce API calls and avoid rate limits
    const interval = setInterval(() => {
      refreshPortfolio();
    }, 120000);

    return () => clearInterval(interval);
  }, [refreshPortfolio]);

  // Use the portfolio state from context instead of local state
  const loadPortfolio = async () => {
    // This function is no longer needed since the PortfolioContext manages all portfolio state
    // The context handles loading, refreshing, and state management
    // We just use the data from the context
    refreshPortfolio();
  };

  const calculateGain = (holding: any) => {
    const gain = (holding.currentPrice - holding.avgPrice) * holding.shares;
    const gainPercent = ((holding.currentPrice - holding.avgPrice) / holding.avgPrice) * 100;
    return { gain, gainPercent };
  };

  const handleAddPosition = async () => {
    if (newPosition.symbol && newPosition.shares > 0 && newPosition.avgPrice > 0) {
      try {
        await addHolding({
          symbol: newPosition.symbol.toUpperCase(),
          shares: newPosition.shares,
          avgPrice: newPosition.avgPrice
        });

        setNewPosition({ symbol: '', shares: 0, avgPrice: 0 });
        setShowAddModal(false);
        showNotification('success', 'Position Added', `Added ${newPosition.shares} shares of ${newPosition.symbol}`);
      } catch (error: any) {
        showNotification('error', 'Add Failed', error.message || 'Failed to add position');
      }
    }
  };

  const handleRemovePosition = (symbol: string) => {
    removeHolding(symbol);
    showNotification('info', 'Position Removed', `Removed ${symbol} from portfolio`);
  };

  const handleRefresh = async () => {
    try {
      await refreshPortfolio();
      showNotification('success', 'Portfolio Refreshed', 'Prices updated successfully');
    } catch (error: any) {
      showNotification('error', 'Refresh Failed', error.message || 'Failed to refresh portfolio');
    }
  };

  const handleClearPortfolio = () => {
    clearPortfolio();
    showNotification('warning', 'Portfolio Cleared', 'All positions removed');
  };

  // Assess risk before executing trade
  const handleAssessRisk = async (holding: any, action: 'ADD' | 'REDUCE') => {
    setRiskChecking(false); // Reset checking state
    setRiskError(null);
    setStopLossError(null);
    setPendingTrade({ holding, action });

    // Initialize stop-loss price (5% below current price for long positions)
    const initialStopLoss = holding.currentPrice * 0.95;
    setStopLossPrice(initialStopLoss);

    try {
      // Call risk assessment endpoint via API service
      const riskResult = await riskAPI.assess({
        symbol: holding.symbol,
        position_size: holding.shares * holding.currentPrice,
        entry_price: holding.currentPrice,
        stop_loss_price: initialStopLoss,
        capital_at_risk_pct: 0.01 // 1% capital at risk
      });

      setRiskAssessment(riskResult);
      setShowRiskModal(true);

      // Check if risk is acceptable
      const riskScore = riskResult.risk_score || 0;
      if (riskScore > 5) {
        showNotification('warning', 'High Risk', `Risk score: ${riskScore.toFixed(1)}. Proceed with caution.`);
      } else {
        showNotification('success', 'Risk OK', `Risk score: ${riskScore.toFixed(1)}. Safe to proceed.`);
      }
    } catch (error: any) {
      const msg = error.message || 'Failed to assess risk';
      setRiskError(msg);
      showNotification('error', 'Risk Assessment Failed', msg);
    }
  };

  // Validate stop-loss price
  const validateStopLoss = (price: number, currentPrice: number, action: string, avgPrice: number) => {
    if (price <= 0) {
      return 'Stop-loss price must be greater than 0';
    }

    // For long positions (ADD)
    if (action === 'ADD') {
      if (price >= currentPrice) {
        return 'Stop-loss must be below current market price for long positions';
      }
      if (price >= avgPrice) {
        return 'Stop-loss should be below entry price for long positions (recommended)';
      }
    }

    // For short positions (REDUCE) - we need to be careful here
    // For a REDUCE action, typically you want to sell if price goes down (for long positions)
    // Or cover if price goes up (for short positions)
    if (action === 'REDUCE') {
      // For reducing a long position, stop-loss should be below current price
      if (pendingTrade?.holding.side === 'long' || !pendingTrade?.holding.side) {
        if (price >= currentPrice) {
          return 'Stop-loss must be below current market price to reduce long position';
        }
      }
      // For reducing a short position, stop-loss should be above current price
      else if (pendingTrade?.holding.side === 'short') {
        if (price <= currentPrice) {
          return 'Stop-loss must be above current market price to reduce short position';
        }
      }
    }

    return null;
  };

  // Update risk assessment when stop-loss changes
  const updateRiskAssessment = async (newStopLoss: number) => {
    if (!pendingTrade) return;

    const { holding, action } = pendingTrade;
    const error = validateStopLoss(newStopLoss, holding.currentPrice, action, holding.avgPrice);

    if (error) {
      setStopLossError(error);
      return;
    }

    setStopLossError(null);

    try {
      // Recalculate risk assessment with new stop-loss using riskAPI
      const riskResult = await riskAPI.assess({
        symbol: holding.symbol,
        position_size: holding.shares * holding.currentPrice,
        entry_price: holding.currentPrice,
        stop_loss_price: newStopLoss,
        capital_at_risk_pct: 0.01
      });

      setRiskAssessment(riskResult);
    } catch (error) {
      console.error('Failed to update risk assessment:', error);
    }
  };

  // Execute trade after confirmation
  const handleExecuteTrade = async () => {
    if (!pendingTrade) return;

    const { holding, action } = pendingTrade;

    // Validate stop-loss before execution
    const error = validateStopLoss(stopLossPrice, holding.currentPrice, action, holding.avgPrice);
    if (error) {
      showNotification('error', 'Invalid Stop-Loss', error);
      return;
    }

    setRiskChecking(true);

    try {
      // Assess risk via API service
      const riskRes = await riskAPI.assess({
        symbol: pendingTrade.holding.symbol,
        position_size: pendingTrade.holding.shares * (pendingTrade.holding.currentPrice || 0),
        entry_price: pendingTrade.holding.avgPrice,
        stop_loss_price: stopLossPrice,
        capital_at_risk_pct: 0.05 // 5% risk threshold example
      });

      // If risk is too high and blocking is enabled, stop here
      if (riskRes.recommendation === 'HIGH_RISK') {
        const msg = `Action blocked: Risk level is too high (${riskRes.risk_percentage?.toFixed(1) || 'N/A'}%).`;
        showNotification('error', 'Action Blocked', msg);
        setRiskChecking(false);
        return;
      }

      // Execute trade via API service
      const result = await tradeAPI.execute(
        pendingTrade.holding.symbol,
        action,
        pendingTrade.holding.shares,
        pendingTrade.holding.currentPrice || 0,
        stopLossPrice
      );

      if (result.success) {
        showNotification('success', `Portfolio Action Executed`,
          `${holding.symbol} ${action === 'ADD' ? 'added to' : 'reduced from'} portfolio. Stop-Loss: ₹${stopLossPrice.toFixed(2)}. ID: ${result.order_id || 'simulated'}`);

        // Update the holding with the new stop-loss
        await updateHoldingStopLoss(pendingTrade.holding.symbol, stopLossPrice);

        // Close modals and reset state
        setShowConfirmModal(false);
        setShowRiskModal(false);
        setPendingTrade(null);
        setRiskAssessment(null);
        setStopLossPrice(0);
        setStopLossError(null);
      } else {
        throw new Error(result.message || 'Portfolio action failed');
      }
    } catch (error: any) {
      const msg = error.message || 'Failed to execute portfolio action';
      showNotification('error', 'Action Failed', msg);
    } finally {
      setRiskChecking(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-4 w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Portfolio</h1>
            <p className="text-gray-400 text-xs sm:text-sm">Educational portfolio management</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white text-xs sm:text-sm font-semibold rounded transition-colors flex items-center justify-center sm:justify-start gap-1.5"
            >
              <RotateCcw className={`w-4 h-4 flex-shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
              <span className="sm:hidden">Refresh</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs sm:text-sm font-semibold rounded transition-colors flex items-center justify-center sm:justify-start gap-1.5"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Add Position</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        <div className="mb-4">
          <PortfolioSelector />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-700">
            <p className="text-gray-400 text-xs mb-1">Total Value</p>
            <p className="text-xl sm:text-2xl font-bold text-white truncate">{formatUSDToINR(portfolioState.totalValue)}</p>
            <p className="text-gray-500 text-xs mt-1">Educational Portfolio</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-700">
            <p className="text-gray-400 text-xs mb-1">Total Gain/Loss</p>
            <p className={`text-xl sm:text-2xl font-bold truncate ${portfolioState.totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {portfolioState.totalGain >= 0 ? '+' : ''}{formatUSDToINR(portfolioState.totalGain)}
            </p>
            <p className={`text-xs mt-1 ${portfolioState.totalGainPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {portfolioState.totalGainPercent >= 0 ? '+' : ''}{(portfolioState.totalGainPercent || 0).toFixed(2)}%
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-700">
            <p className="text-gray-400 text-xs mb-1">Holdings</p>
            <p className="text-xl sm:text-2xl font-bold text-white">{portfolioState.holdings.length}</p>
            <p className="text-gray-500 text-xs mt-1">Positions</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-700">
            <p className="text-gray-400 text-xs mb-1">Last Updated</p>
            <p className="text-white text-sm font-medium truncate">
              {portfolioState.lastUpdated
                ? portfolioState.lastUpdated.toLocaleTimeString()
                : 'Never'}
            </p>
            <p className="text-gray-500 text-xs mt-1">Simulation Data</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-slate-700 flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm sm:text-base font-semibold text-white">Holdings</h2>
            {portfolioState.holdings.length > 0 && (
              <button
                onClick={handleClearPortfolio}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-gray-400">Loading portfolio...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-400">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
              <p className="text-xs sm:text-sm">{error}</p>
              <button
                onClick={handleRefresh}
                className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs sm:text-sm"
              >
                Retry
              </button>
            </div>
          ) : portfolioState.holdings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-slate-700 sticky top-0">
                  <tr>
                    <th className="px-2 sm:px-3 py-2 text-left font-medium text-gray-300 uppercase">Symbol</th>
                    <th className="px-2 sm:px-3 py-2 text-left font-medium text-gray-300 uppercase">Shares</th>
                    <th className="px-2 sm:px-3 py-2 text-left font-medium text-gray-300 uppercase hidden sm:table-cell">Avg Price</th>
                    <th className="px-2 sm:px-3 py-2 text-left font-medium text-gray-300 uppercase hidden md:table-cell">Curr Price</th>
                    <th className="px-2 sm:px-3 py-2 text-left font-medium text-gray-300 uppercase hidden lg:table-cell">Stop-Loss</th>
                    <th className="px-2 sm:px-3 py-2 text-left font-medium text-gray-300 uppercase">Value</th>
                    <th className="px-2 sm:px-3 py-2 text-left font-medium text-gray-300 uppercase hidden sm:table-cell">Gain/Loss</th>
                    <th className="px-2 sm:px-3 py-2 text-left font-medium text-gray-300 uppercase text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {portfolioState.holdings.map((holding, index) => {
                    const { gain, gainPercent } = calculateGain(holding);
                    return (
                      <tr key={index} className="hover:bg-slate-700/50 transition-colors">
                        <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap">
                          <span className="text-white font-semibold text-xs sm:text-sm">{holding.symbol}</span>
                        </td>
                        <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-gray-300">{holding.shares}</td>
                        <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-gray-300 hidden sm:table-cell">{formatUSDToINR(holding.avgPrice || 0, holding.symbol)}</td>
                        <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-white hidden md:table-cell">{formatUSDToINR(holding.currentPrice || 0, holding.symbol)}</td>
                        <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-white hidden lg:table-cell">
                          {holding.stopLossPrice ? (
                            <div className="flex flex-col">
                              <span>{formatUSDToINR(holding.stopLossPrice, holding.symbol)}</span>
                              <span className="text-xs text-gray-400">({((holding.stopLossPrice - holding.avgPrice) / holding.avgPrice * 100).toFixed(1)}%)</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-white text-xs sm:text-sm">{formatUSDToINR(holding.value)}</td>
                        <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap hidden sm:table-cell">
                          <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm">
                            {gain >= 0 ? (
                              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-400 flex-shrink-0" />
                            ) : (
                              <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-red-400 flex-shrink-0" />
                            )}
                            <span className={gain >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {formatUSDToINR(gain || 0, holding.symbol)} ({gainPercent >= 0 ? '+' : ''}{(gainPercent || 0).toFixed(2)}%)
                            </span>
                          </div>
                        </td>
                        <td className="px-1 sm:px-3 py-2 sm:py-3 whitespace-nowrap">
                          <div className="flex gap-0.5 sm:gap-1 justify-end">
                            <button
                              onClick={() => handleAssessRisk(holding, 'ADD')}
                              disabled={riskChecking}
                              className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white text-xs rounded transition-colors flex-shrink-0"
                              title="Add to Portfolio (Simulated)"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => handleAssessRisk(holding, 'REDUCE')}
                              disabled={riskChecking}
                              className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-400 text-white text-xs rounded transition-colors flex-shrink-0"
                              title="Reduce Exposure (Simulated)"
                            >
                              <span className="hidden sm:inline">Reduce</span>
                              <span className="sm:hidden">Red</span>
                            </button>
                            <button
                              onClick={() => handleRemovePosition(holding.symbol)}
                              className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 bg-slate-600 hover:bg-slate-700 text-white text-xs rounded transition-colors flex-shrink-0"
                              title="Remove from Portfolio"
                            >
                              <span className="hidden sm:inline">Remove</span>
                              <span className="sm:hidden">X</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 sm:p-8 text-center text-gray-400">
              <BookOpen className="w-12 h-12 sm:w-12 sm:h-12 mx-auto mb-3 text-slate-600" />
              <p className="mb-2 text-sm sm:text-base">No holdings in this portfolio</p>
              <p className="text-xs sm:text-sm text-gray-500 mb-4">Add positions to start learning about portfolio management</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-medium"
              >
                Add First Position
              </button>
            </div>
          )}
        </div>

        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg p-4 sm:p-6 border border-slate-700 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg sm:text-xl font-semibold text-white mb-4">Add Position</h3>
              <div className="space-y-3 sm:space-y-4">
                <div className="relative">
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Symbol</label>
                  <input
                    type="text"
                    value={newPosition.symbol}
                    onChange={(e) => handleSymbolInput(e.target.value)}
                    placeholder="e.g., AAPL, TCS.NS"
                    className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-xs sm:text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {/* Suggestions Dropdown */}
                  {suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {suggestions.map((stock) => (
                        <button
                          key={stock}
                          type="button"
                          onClick={() => handleSelectSuggestion(stock)}
                          className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-left text-white text-xs sm:text-sm hover:bg-slate-600 transition-colors first:rounded-t-lg last:rounded-b-lg border-b border-slate-600 last:border-b-0"
                        >
                          {stock}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Shares</label>
                  <input
                    type="number"
                    value={newPosition.shares || ''}
                    onChange={(e) => setNewPosition({ ...newPosition, shares: parseFloat(e.target.value) || 0 })}
                    placeholder="Number of shares"
                    className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Average Price</label>
                  <input
                    type="number"
                    value={newPosition.avgPrice || ''}
                    onChange={(e) => setNewPosition({ ...newPosition, avgPrice: parseFloat(e.target.value) || 0 })}
                    placeholder="Purchase price per share"
                    step="0.01"
                    className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button
                    onClick={handleAddPosition}
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white text-xs sm:text-sm rounded-lg font-medium"
                  >
                    {isLoading ? 'Adding...' : 'Add to Portfolio'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setNewPosition({ symbol: '', shares: 0, avgPrice: 0 });
                    }}
                    className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-xs sm:text-sm rounded-lg"
                  >
                    Cancel
                  </button>
                </div>

                <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-2 sm:p-3 mt-4">
                  <div className="flex items-start gap-2">
                    <Info className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-yellow-200 text-xs font-medium mb-1">Educational Simulation</p>
                      <p className="text-yellow-300 text-xs">
                        This is a learning environment. No real money is involved. All transactions are simulated.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Risk Assessment Modal */}
        {showRiskModal && riskAssessment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg p-4 sm:p-6 border border-slate-700 max-w-md w-full">
              <div className="flex items-center gap-2 sm:gap-3 mb-4">
                {riskAssessment.risk_score > 5 ? (
                  <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 flex-shrink-0" />
                ) : (
                  <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 flex-shrink-0" />
                )}
                <h3 className="text-lg sm:text-xl font-semibold text-white">
                  Risk Assessment
                </h3>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div className="bg-slate-700/50 rounded-lg p-3 sm:p-4">
                  <p className="text-gray-300 text-xs sm:text-sm mb-1">Risk Score</p>
                  <p className={`text-xl sm:text-2xl font-bold ${riskAssessment.risk_score > 5 ? 'text-red-400' : 'text-green-400'
                    }`}>
                    {(riskAssessment.risk_score || 0).toFixed(1)} / 10
                  </p>
                  <p className="text-gray-400 text-xs mt-2">
                    {riskAssessment.risk_level || 'Medium Risk'}
                  </p>
                </div>

                <div className="bg-slate-700/50 rounded-lg p-3 sm:p-4">
                  <p className="text-gray-300 text-xs sm:text-sm mb-2">Recommendation</p>
                  <p className="text-white text-xs sm:text-sm">
                    {riskAssessment.recommendation || 'Proceed with caution'}
                  </p>
                </div>

                {riskAssessment.risk_score > 5 && (
                  <div className="bg-red-900/30 border border-red-800 rounded-lg p-2 sm:p-3">
                    <p className="text-red-200 text-xs sm:text-sm">
                      ⚠️ High Risk Alert: Risk score exceeds 5%. Confirm to proceed or cancel.
                    </p>
                  </div>
                )}

                {/* Stop-Loss Input */}
                <div className="bg-slate-700/50 rounded-lg p-3 sm:p-4">
                  <label className="block text-gray-300 text-xs sm:text-sm mb-2">Stop-Loss Price</label>
                  <input
                    type="number"
                    value={stopLossPrice || ''}
                    onChange={(e) => {
                      const newPrice = parseFloat(e.target.value) || 0;
                      setStopLossPrice(newPrice);
                      updateRiskAssessment(newPrice);
                    }}
                    step="0.01"
                    className="w-full px-3 py-1.5 bg-slate-600 border border-slate-500 rounded text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter stop-loss price"
                  />
                  {stopLossError && (
                    <p className="text-red-400 text-xs mt-1">{stopLossError}</p>
                  )}
                  <p className="text-gray-400 text-xs mt-1">
                    Current: ₹{pendingTrade?.holding.currentPrice.toFixed(2)}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button
                    onClick={() => {
                      const error = validateStopLoss(stopLossPrice, pendingTrade.holding.currentPrice, pendingTrade.action, pendingTrade.holding.avgPrice);
                      if (error) {
                        showNotification('error', 'Invalid Stop-Loss', error);
                        return;
                      }
                      setShowConfirmModal(true);
                    }}
                    disabled={riskChecking || !!stopLossError}
                    className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white text-xs sm:text-sm rounded-lg font-semibold flex items-center justify-center gap-2"
                  >
                    {riskChecking && (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    )}
                    {riskChecking ? 'Processing...' : 'Proceed to Confirm'}
                  </button>
                  <button
                    onClick={() => {
                      setShowRiskModal(false);
                      setPendingTrade(null);
                      setRiskAssessment(null);
                      setStopLossPrice(0);
                      setStopLossError(null);
                      setRiskChecking(false);
                    }}
                    className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-xs sm:text-sm rounded-lg font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trade Confirmation Modal */}
        {showConfirmModal && pendingTrade && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg p-4 sm:p-6 border border-slate-700 max-w-md w-full">
              <h3 className="text-lg sm:text-xl font-semibold text-white mb-4">
                Confirm Portfolio Action
              </h3>

              <div className="space-y-2 sm:space-y-3 mb-4 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300">Symbol:</span>
                  <span className="text-white font-semibold">{pendingTrade.holding.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Action:</span>
                  <span className={`font-semibold ${pendingTrade.action === 'ADD' ? 'text-green-400' : 'text-orange-400'
                    }`}>
                    {pendingTrade.action === 'ADD' ? 'Add to Portfolio' : 'Reduce Exposure'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Quantity:</span>
                  <span className="text-white">{pendingTrade.holding.shares} shares</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Price:</span>
                  <span className="text-white">₹{(pendingTrade.holding.currentPrice || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-700 pt-2 sm:pt-3">
                  <span className="text-gray-300 font-semibold">Total:</span>
                  <span className="text-white font-bold">
                    ₹{(pendingTrade.holding.shares * (pendingTrade.holding.currentPrice || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-2 sm:p-3 mb-4">
                <p className="text-yellow-200 text-xs sm:text-sm">
                  📋 Please review the order details carefully before confirming.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={handleExecuteTrade}
                  disabled={riskChecking}
                  className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white text-xs sm:text-sm rounded-lg font-semibold flex items-center justify-center gap-2"
                >
                  {riskChecking && (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                  {riskChecking ? 'Processing...' : 'Confirm Action'}
                </button>
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setShowRiskModal(true);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-xs sm:text-sm rounded-lg font-semibold"
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PortfolioPage;

