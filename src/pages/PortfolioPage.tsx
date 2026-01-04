import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { TrendingUp, TrendingDown, Plus } from 'lucide-react';
import { stockAPI, TimeoutError, type PredictionItem } from '../services/api';

const PortfolioPage = () => {
  const [holdings, setHoldings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalValue, setTotalValue] = useState(0);
  const [totalGain, setTotalGain] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPosition, setNewPosition] = useState({ symbol: '', shares: 0, avgPrice: 0 });

  useEffect(() => {
    loadPortfolio();
    // Refresh every 120 seconds (2 minutes) to reduce API calls and avoid rate limits
    const interval = setInterval(() => {
      loadPortfolio();
    }, 120000);
    return () => clearInterval(interval);
  }, []);

  const loadPortfolio = async () => {
    setLoading(true);
    try {
      // Load holdings from localStorage (user-managed portfolio)
      const savedHoldings = localStorage.getItem('portfolio_holdings');
      let userHoldings: Holding[] = savedHoldings ? JSON.parse(savedHoldings) : [];
      
      // If no holdings, show empty state
      if (userHoldings.length === 0) {
        setHoldings([]);
        setTotalValue(0);
        setTotalGain(0);
        setLoading(false);
        return;
      }
      
      // Fetch real-time prices from backend
      const symbols = userHoldings.map(h => h.symbol);
      
      try {
        const response = await stockAPI.predict(symbols, 'intraday');
        
        // Check for errors in metadata
        if (response.metadata?.error) {
          throw new Error(response.metadata.error);
        }
        
        if (response.predictions) {
          // Filter out predictions with errors and map to holdings
          const validPredictions = response.predictions.filter((p: PredictionItem) => !p.error);
          
          // Update holdings with real-time prices
          const updatedHoldings = userHoldings.map((holding) => {
            const prediction = validPredictions.find((p: PredictionItem) => p.symbol === holding.symbol);
            if (prediction) {
              const currentPrice = prediction.predicted_price || prediction.current_price || holding.avgPrice;
              return {
                ...holding,
                currentPrice: currentPrice,
                value: holding.shares * currentPrice,
              };
            }
            // If no prediction available, use stored price
            return {
              ...holding,
              currentPrice: holding.currentPrice || holding.avgPrice,
              value: holding.shares * (holding.currentPrice || holding.avgPrice),
            };
          });
          
          setHoldings(updatedHoldings);
          
          // Calculate totals using real prices
          const total = updatedHoldings.reduce((sum, h) => sum + h.value, 0);
          const gain = updatedHoldings.reduce((sum, h) => sum + (h.currentPrice - h.avgPrice) * h.shares, 0);
          setTotalValue(total);
          setTotalGain(gain);
        } else {
          // No predictions, use stored data
          setHoldings(userHoldings);
          const total = userHoldings.reduce((sum, h) => sum + (h.value || h.shares * (h.currentPrice || h.avgPrice)), 0);
          const gain = userHoldings.reduce((sum, h) => sum + (h.currentPrice - h.avgPrice) * h.shares, 0);
          setTotalValue(total);
          setTotalGain(gain);
        }
      } catch (apiError: unknown) {
        // Handle TimeoutError - backend is still processing
        if (apiError instanceof TimeoutError) {
          // Keep loading state active, use stored holdings for now
          console.log('PortfolioPage: Request timed out but backend is still processing');
          setHoldings(userHoldings);
          const total = userHoldings.reduce((sum, h) => sum + (h.value || h.shares * (h.currentPrice || h.avgPrice)), 0);
          const gain = userHoldings.reduce((sum, h) => sum + (h.currentPrice - h.avgPrice) * h.shares, 0);
          setTotalValue(total);
          setTotalGain(gain);
          // Don't clear loading - backend is still working
          return;
        }
        
        // Handle actual errors - use stored holdings without price updates
        console.error('Failed to fetch real-time prices:', apiError);
        setHoldings(userHoldings);
        const total = userHoldings.reduce((sum, h) => sum + (h.value || h.shares * (h.currentPrice || h.avgPrice)), 0);
        const gain = userHoldings.reduce((sum, h) => sum + (h.currentPrice - h.avgPrice) * h.shares, 0);
        setTotalValue(total);
        setTotalGain(gain);
      }
      setLoading(false);
    } catch (error: unknown) {
      console.error('Failed to load portfolio:', error);
      setHoldings([]);
      setTotalValue(0);
      setTotalGain(0);
      setLoading(false);
    }
  };

  const calculateGain = (holding: Holding) => {
    const gain = (holding.currentPrice - holding.avgPrice) * holding.shares;
    const gainPercent = ((holding.currentPrice - holding.avgPrice) / holding.avgPrice) * 100;
    return { gain, gainPercent };
  };

  const addPosition = async () => {
    if (newPosition.symbol && newPosition.shares > 0 && newPosition.avgPrice > 0) {
      // Fetch current price from backend
      let currentPrice = newPosition.avgPrice;
      try {
        const response = await stockAPI.predict([newPosition.symbol], 'intraday');
        if (response.predictions && response.predictions.length > 0) {
          const prediction = response.predictions.find((p: PredictionItem) => !p.error);
          if (prediction) {
            currentPrice = prediction.predicted_price || prediction.current_price || newPosition.avgPrice;
          }
        }
      } catch (error) {
        console.warn('Failed to fetch current price, using average price:', error);
      }
      
      const holding = {
        symbol: newPosition.symbol.toUpperCase(),
        shares: newPosition.shares,
        avgPrice: newPosition.avgPrice,
        currentPrice: currentPrice,
        value: newPosition.shares * currentPrice,
      };
      
      // Save to localStorage
      const updatedHoldings = [...holdings, holding];
      localStorage.setItem('portfolio_holdings', JSON.stringify(updatedHoldings));
      setHoldings(updatedHoldings);
      setNewPosition({ symbol: '', shares: 0, avgPrice: 0 });
      setShowAddModal(false);
      
      // Update totals
      const total = updatedHoldings.reduce((sum, h) => sum + h.value, 0);
      const gain = updatedHoldings.reduce((sum, h) => sum + (h.currentPrice - h.avgPrice) * h.shares, 0);
      setTotalValue(total);
      setTotalGain(gain);
    }
  };

  const removePosition = (index: number) => {
    const newHoldings = holdings.filter((_, i) => i !== index);
    // Save to localStorage
    localStorage.setItem('portfolio_holdings', JSON.stringify(newHoldings));
    setHoldings(newHoldings);
    // Update totals
    const total = newHoldings.reduce((sum, h) => sum + h.value, 0);
    const gain = newHoldings.reduce((sum, h) => sum + (h.currentPrice - h.avgPrice) * h.shares, 0);
    setTotalValue(total);
    setTotalGain(gain);
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white mb-1">Portfolio</h1>
            <p className="text-gray-400 text-xs">Manage your holdings</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Position</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <p className="text-gray-400 text-xs mb-1">Total Value</p>
            <p className="text-xl font-bold text-white">${totalValue.toLocaleString()}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <p className="text-gray-400 text-xs mb-1">Total Gain/Loss</p>
            <p className={`text-xl font-bold ${totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${totalGain >= 0 ? '+' : ''}{totalGain.toLocaleString()}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <p className="text-gray-400 text-xs mb-1">Holdings</p>
            <p className="text-xl font-bold text-white">{holdings.length}</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="p-3 border-b border-slate-700">
            <h2 className="text-sm font-semibold text-white">Holdings</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : holdings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">Symbol</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">Shares</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">Avg Price</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">Current Price</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">Value</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">Gain/Loss</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {holdings.map((holding, index) => {
                    const { gain, gainPercent } = calculateGain(holding);
                    return (
                      <tr key={index} className="hover:bg-slate-700/50">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-white font-semibold">{holding.symbol}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-300">{holding.shares}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-300">${holding.avgPrice.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-white">${holding.currentPrice.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-white">${holding.value.toLocaleString()}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            {gain >= 0 ? (
                              <TrendingUp className="w-4 h-4 text-green-400" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-red-400" />
                            )}
                            <span className={gain >= 0 ? 'text-green-400' : 'text-red-400'}>
                              ${gain.toFixed(2)} ({gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%)
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => {
                                const currentShares = holding.shares;
                                setNewPosition({ 
                                  symbol: holding.symbol, 
                                  shares: currentShares + 1, 
                                  avgPrice: holding.currentPrice 
                                });
                                setShowAddModal(true);
                              }}
                              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
                            >
                              Buy
                            </button>
                            <button 
                              onClick={() => {
                                const currentShares = holding.shares;
                                if (currentShares > 1) {
                                  const updated = holdings.map((h, i) => 
                                    i === index ? { ...h, shares: currentShares - 1, value: (currentShares - 1) * h.currentPrice } : h
                                  );
                                  // Save to localStorage
                                  localStorage.setItem('portfolio_holdings', JSON.stringify(updated));
                                  setHoldings(updated);
                                  // Update totals
                                  const total = updated.reduce((sum, h) => sum + h.value, 0);
                                  const gain = updated.reduce((sum, h) => sum + (h.currentPrice - h.avgPrice) * h.shares, 0);
                                  setTotalValue(total);
                                  setTotalGain(gain);
                                } else {
                                  removePosition(index);
                                }
                              }}
                              className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors"
                            >
                              Sell
                            </button>
                            <button 
                              onClick={() => removePosition(index)}
                              className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded transition-colors"
                            >
                              Remove
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
            <div className="p-8 text-center text-gray-400">No holdings found</div>
          )}
        </div>

        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 max-w-md w-full mx-4">
              <h3 className="text-xl font-semibold text-white mb-4">Add Position</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Symbol</label>
                  <input
                    type="text"
                    value={newPosition.symbol}
                    onChange={(e) => setNewPosition({ ...newPosition, symbol: e.target.value })}
                    placeholder="e.g., AAPL"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Shares</label>
                  <input
                    type="number"
                    value={newPosition.shares || ''}
                    onChange={(e) => setNewPosition({ ...newPosition, shares: parseFloat(e.target.value) || 0 })}
                    placeholder="Number of shares"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Average Price</label>
                  <input
                    type="number"
                    value={newPosition.avgPrice || ''}
                    onChange={(e) => setNewPosition({ ...newPosition, avgPrice: parseFloat(e.target.value) || 0 })}
                    placeholder="Purchase price per share"
                    step="0.01"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={addPosition}
                    className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setNewPosition({ symbol: '', shares: 0, avgPrice: 0 });
                    }}
                    className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PortfolioPage;

