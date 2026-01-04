import { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, Sparkles, Loader2, BarChart3 } from 'lucide-react';
import { POPULAR_STOCKS } from '../services/api';

interface StocksViewProps {
  onSearch: (symbol: string) => void;
  onAnalyze?: (symbol: string) => void;
  predictions: any[];
  loading: boolean;
  error: string | null;
  horizon?: 'intraday' | 'short' | 'long';
  onHorizonChange?: (horizon: 'intraday' | 'short' | 'long') => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

const StocksView = ({ onSearch, onAnalyze, predictions, loading, error, horizon = 'intraday', onHorizonChange, searchQuery: externalSearchQuery, onSearchQueryChange }: StocksViewProps) => {
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = onSearchQueryChange || setInternalSearchQuery;

  // Sync external search query to internal state
  useEffect(() => {
    if (externalSearchQuery !== undefined) {
      setInternalSearchQuery(externalSearchQuery);
    }
  }, [externalSearchQuery]);

  // Generate suggestions based on search query
  useEffect(() => {
    if (searchQuery && searchQuery.length > 0) {
      const query = searchQuery.toUpperCase();
      const filtered = POPULAR_STOCKS.filter(symbol => 
        symbol.toUpperCase().includes(query) || 
        symbol.replace('.NS', '').toUpperCase().includes(query)
      ).slice(0, 8); // Show max 8 suggestions
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchQuery]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          Stocks Market
        </h2>
        <p className="text-gray-400 text-xs">Search and analyze stocks with AI-powered predictions</p>
      </div>

      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-lg p-3 border border-slate-700/50">
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                setSearchQuery(value);
              }}
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              onBlur={() => {
                // Delay hiding suggestions to allow click events
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && searchQuery) {
                  setShowSuggestions(false);
                  onSearch(searchQuery);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setShowSuggestions(false);
                }
              }}
              placeholder="Enter stock symbol (e.g., AAPL, GOOGL, MSFT)"
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-700/50 border border-slate-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            
            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                {suggestions.map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    onClick={() => {
                      setSearchQuery(symbol);
                      setShowSuggestions(false);
                      onSearch(symbol);
                    }}
                    onMouseDown={(e) => e.preventDefault()} // Prevent onBlur from firing
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center justify-between"
                  >
                    <span className="font-medium">{symbol.replace('.NS', '')}</span>
                    {symbol.includes('.NS') && (
                      <span className="text-xs text-gray-500">NSE</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {onHorizonChange && (
            <select
              value={horizon}
              onChange={(e) => onHorizonChange(e.target.value as any)}
              className="px-2.5 py-1.5 text-sm bg-slate-700/50 border border-slate-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option value="intraday">📈 Intraday</option>
              <option value="short">📅 Short (5 days)</option>
              <option value="long">📆 Long (30 days)</option>
            </select>
          )}
          <button
            onClick={() => searchQuery && onSearch(searchQuery)}
            disabled={loading || !searchQuery}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Search</span>
          </button>
          {searchQuery && onAnalyze && (
            <button
              onClick={() => onAnalyze(searchQuery)}
              disabled={loading}
              className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
              <span>Deep Analyze</span>
            </button>
          )}
        </div>

        <div>
          <p className="text-gray-300 mb-3 font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            Popular Stocks:
          </p>
          <div className="flex flex-wrap gap-2">
            {POPULAR_STOCKS.slice(0, 20).map((symbol) => (
              <button
                key={symbol}
                onClick={() => {
                  setSearchQuery(symbol);
                  onSearch(symbol);
                }}
                className="px-3 py-1.5 bg-slate-700/50 text-gray-300 hover:bg-blue-500 hover:text-white rounded-lg text-sm font-medium transition-all hover:scale-105"
              >
                {symbol.replace('.NS', '')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border-2 border-red-500/50 rounded-xl p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {loading && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          <span className="text-blue-400 font-semibold">Loading predictions...</span>
        </div>
      )}

      {!loading && !error && predictions.length === 0 && searchQuery && (
        <div className="bg-yellow-900/30 border-2 border-yellow-500/50 rounded-xl p-4">
          <p className="text-yellow-400">No predictions found. Try searching for a different symbol or check if the backend is running.</p>
        </div>
      )}

      {predictions.length > 0 && (
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-400" />
            Predictions for {searchQuery}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {predictions.map((pred, index) => {
              const confidence = (pred.confidence || 0) * 100;
              const isPositive = (pred.predicted_return || 0) > 0;
              
              return (
                <div
                  key={index}
                  className="bg-gradient-to-br from-slate-700/50 to-slate-600/30 rounded-xl p-5 border border-slate-600/50 hover:border-blue-500/50 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-white font-bold text-lg">{pred.symbol}</p>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                        pred.action === 'LONG' ? 'bg-green-500/20 text-green-400' :
                        pred.action === 'SHORT' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {pred.action || 'HOLD'}
                      </span>
                    </div>
                    {getActionIcon(pred.action)}
                  </div>
                  
                  <div className="space-y-2">
                    {pred.current_price && (
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Current Price:</span>
                        <span className="text-white font-semibold">${pred.current_price.toFixed(2)}</span>
                      </div>
                    )}
                    {pred.predicted_price && (
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Predicted Price:</span>
                        <span className="text-white font-semibold">${pred.predicted_price.toFixed(2)}</span>
                      </div>
                    )}
                    {pred.predicted_return !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Expected Return:</span>
                        <span className={`font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                          {isPositive ? '+' : ''}{pred.predicted_return.toFixed(2)}%
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Confidence:</span>
                      <span className={`font-semibold ${
                        confidence > 70 ? 'text-green-400' :
                        confidence > 50 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {confidence.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  
                  {pred.reason && (
                    <div className="mt-3 pt-3 border-t border-slate-600/50">
                      <p className="text-gray-300 text-xs leading-relaxed">{pred.reason}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const getActionIcon = (action: string) => {
  switch (action?.toUpperCase()) {
    case 'LONG':
    case 'BUY':
      return <TrendingUp className="w-5 h-5 text-green-400" />;
    case 'SHORT':
    case 'SELL':
      return <TrendingDown className="w-5 h-5 text-red-400" />;
    case 'HOLD':
    default:
      return <div className="w-5 h-5" />;
  }
};

export default StocksView;
