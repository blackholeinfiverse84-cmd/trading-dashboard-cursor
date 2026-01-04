import { useState, useEffect } from 'react';
import { Search, Coins, Loader2, Zap, BarChart3 } from 'lucide-react';
import { POPULAR_CRYPTO } from '../services/api';

interface CryptoViewProps {
  onSearch: (symbol: string) => void;
  onAnalyze?: (symbol: string) => void;
  predictions: any[];
  loading: boolean;
  error: string | null;
  horizon?: 'intraday' | 'short' | 'long';
  onHorizonChange?: (horizon: 'intraday' | 'short' | 'long') => void;
}

const CryptoView = ({ onSearch, onAnalyze, predictions, loading, error, horizon = 'intraday', onHorizonChange }: CryptoViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Generate suggestions based on search query
  useEffect(() => {
    if (searchQuery && searchQuery.length > 0) {
      const query = searchQuery.toUpperCase();
      const filtered = POPULAR_CRYPTO.filter(symbol => 
        symbol.toUpperCase().includes(query)
      ).slice(0, 8);
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
          <Coins className="w-5 h-5 text-yellow-400" />
          Cryptocurrency Market
        </h2>
        <p className="text-gray-400 text-xs">Track and analyze cryptocurrencies with real-time predictions</p>
      </div>

      <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 backdrop-blur-sm rounded-lg p-3 border border-yellow-500/30">
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              onBlur={() => {
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
              placeholder="Enter crypto symbol (e.g., BTC-USD, ETH-USD, SOL-USD)"
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-700/50 border border-slate-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-500"
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
                    onMouseDown={(e) => e.preventDefault()}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    <span className="font-medium">{symbol}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {onHorizonChange && (
            <select
              value={horizon}
              onChange={(e) => onHorizonChange(e.target.value as any)}
              className="px-2.5 py-1.5 text-sm bg-slate-700/50 border border-slate-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-yellow-500 font-medium"
            >
              <option value="intraday">📈 Intraday</option>
              <option value="short">📅 Short (5 days)</option>
              <option value="long">📆 Long (30 days)</option>
            </select>
          )}
          <button
            onClick={() => onSearch(searchQuery)}
            disabled={loading || !searchQuery}
            className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-semibold rounded transition-all disabled:opacity-50 flex items-center gap-1.5"
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
            <Zap className="w-4 h-4 text-yellow-400" />
            Popular Cryptocurrencies:
          </p>
          <div className="flex flex-wrap gap-2">
            {POPULAR_CRYPTO.slice(0, 20).map((symbol) => (
              <button
                key={symbol}
                onClick={() => onSearch(symbol)}
                className="px-3 py-1.5 bg-slate-700/50 text-gray-300 hover:bg-yellow-500 hover:text-white rounded-lg text-sm font-medium transition-all hover:scale-105"
              >
                {symbol.replace('-USD', '')}
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
        <div className="bg-slate-800/80 rounded-xl p-8 border border-slate-700/50 text-center">
          <Loader2 className="w-12 h-12 text-yellow-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Fetching crypto predictions from backend...</p>
          <p className="text-gray-500 text-sm mt-2">This may take 60-90 seconds for first-time predictions</p>
        </div>
      )}

      {!loading && predictions.length === 0 && !error && (
        <div className="bg-slate-800/80 rounded-xl p-8 border border-slate-700/50 text-center">
          <Coins className="w-16 h-16 text-yellow-400 mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold text-white mb-2">Ready to Search Cryptocurrencies</h3>
          <p className="text-gray-400 mb-4">Enter a crypto symbol (e.g., BTC-USD) above or click a popular crypto to get AI-powered predictions</p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {POPULAR_CRYPTO.slice(0, 10).map((symbol) => (
              <button
                key={symbol}
                onClick={() => onSearch(symbol)}
                className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-sm font-medium transition-all border border-yellow-500/30"
              >
                {symbol.replace('-USD', '')}
              </button>
            ))}
          </div>
        </div>
      )}

      {predictions.length > 0 && (
        <div className="bg-slate-800/80 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-400" />
            Crypto Predictions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {predictions.map((pred, index) => {
              const symbol = pred.symbol?.replace('-USD', '') || pred.symbol;
              return (
                <div key={index} className="bg-gradient-to-br from-yellow-900/20 to-orange-900/10 rounded-lg p-4 border border-yellow-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Coins className="w-5 h-5 text-yellow-400" />
                      <span className="text-white font-bold text-lg">{symbol}</span>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      pred.action === 'LONG' ? 'bg-green-500/20 text-green-400' :
                      pred.action === 'SHORT' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {pred.action || 'HOLD'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-400 text-sm">Current: ${pred.current_price?.toFixed(2) || 'N/A'}</p>
                    <p className="text-white font-semibold">Predicted: ${pred.predicted_price?.toFixed(2) || 'N/A'}</p>
                    <p className={`text-sm font-semibold ${(pred.predicted_return || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(pred.predicted_return || 0) > 0 ? '+' : ''}{pred.predicted_return?.toFixed(2) || 0}%
                    </p>
                    <p className="text-gray-400 text-xs">Confidence: {((pred.confidence || 0) * 100).toFixed(0)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CryptoView;

