import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { stockAPI, TimeoutError, type PredictionItem, type AnalyzeResponse } from '../services/api';
import { useAssetType } from '../contexts/AssetTypeContext';
import StocksView from '../components/StocksView';
import CryptoView from '../components/CryptoView';
import CommoditiesView from '../components/CommoditiesView';
import { TrendingUp, TrendingDown, Minus, BarChart3, ThumbsUp, Sparkles, Loader2, X, ChevronDown, ChevronUp, Brain, Cpu, Zap, AlertCircle } from 'lucide-react';
import StopLoss from '../components/StopLoss';
import CandlestickChart from '../components/CandlestickChart';

// Inner component that uses the context (wrapped by Layout)
const MarketScanContent = () => {
  const { assetType } = useAssetType();
  
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  // Removed selectedSymbols - not currently used in UI
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<'intraday' | 'short' | 'long'>('intraday');
  const [analyzeResults, setAnalyzeResults] = useState<AnalyzeResponse | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionItem | null>(null);
  const [expandedPredictions, setExpandedPredictions] = useState<Set<number>>(new Set());
  const [showChart, setShowChart] = useState(false);
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [actualReturn, setActualReturn] = useState<string>('');
  const [feedbackText, setFeedbackText] = useState<string>('');

  // Check backend connection on mount and periodically
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const result = await stockAPI.checkConnection();
        if (!result.connected) {
          setError(result.error || 'Backend server is not reachable');
        } else {
          // Clear error if connection is successful
          setError((prevError) => {
            if (prevError && prevError.includes('Unable to connect')) {
              return null;
            }
            return prevError;
          });
        }
      } catch (err) {
        console.error('Connection check failed:', err);
        setError('Failed to check backend connection');
      }
    };
    
    // Check immediately
    checkConnection();
    
    // Check every 120 seconds (2 minutes) to reduce API calls and stay under rate limit
    const interval = setInterval(checkConnection, 120000);
    
    return () => clearInterval(interval);
  }, []); // Empty dependency array - only run on mount

  // Load search query from URL params on mount and when params change
  useEffect(() => {
    const queryParam = searchParams.get('q');
    if (queryParam) {
      console.log('MarketScanPage: Loading search query from URL:', queryParam);
      setSearchQuery(queryParam);
      // Trigger search immediately
      handleSearch(queryParam);
    }
  }, [searchParams]);

  // Reset state when asset type changes
  useEffect(() => {
    setPredictions([]);
    setError(null);
    // Don't clear searchQuery here - let URL params handle it
  }, [assetType]);

  const handleSearch = async (symbol: string) => {
    if (!symbol || symbol.trim() === '') {
      console.log('MarketScanPage: Empty symbol, skipping search');
      return;
    }
    
    const trimmedSymbol = symbol.trim().toUpperCase();
    console.log('MarketScanPage: Starting search for symbol:', trimmedSymbol);
    
    setLoading(true);
    setError(null);
    setPredictions([]); // Clear previous results immediately
    setSearchQuery(trimmedSymbol); // Update search query state
    
    try {
      console.log('MarketScanPage: Calling API with symbol:', trimmedSymbol, 'horizon:', horizon);
      const response = await stockAPI.predict([trimmedSymbol], horizon);
      
      console.log('MarketScanPage: API response received:', response);
      
      // Check for errors in metadata
      if (response.metadata?.error) {
        throw new Error(response.metadata.error);
      }
      
      // Backend returns: { metadata, predictions }
      // Filter out predictions with errors
      const validPredictions = (response.predictions || []).filter((p: PredictionItem) => !p.error);
      
      console.log('MarketScanPage: Valid predictions found:', validPredictions.length);
      
      if (validPredictions.length > 0) {
        setPredictions(validPredictions);
        setError(null);
        console.log('MarketScanPage: Predictions set successfully');
      } else {
        setPredictions([]);
        // Check if there were errors in the predictions
        const errors = (response.predictions || []).filter((p: PredictionItem) => p.error);
        if (errors.length > 0) {
          const errorMsg = errors[0].error || 'Prediction failed for this symbol';
          setError(errorMsg);
          console.error('MarketScanPage: Prediction error:', errorMsg);
        } else {
          const errorMsg = `No predictions found for "${trimmedSymbol}". The symbol may not exist or models may need training.`;
          setError(errorMsg);
          console.warn('MarketScanPage:', errorMsg);
        }
      }
    } catch (error: unknown) {
      // Handle TimeoutError - backend is still processing
      if (error instanceof TimeoutError) {
        // Keep loading state active, show processing message
        setError(null); // Clear any previous errors
        console.log('MarketScanPage: Request timed out but backend is still processing');
        // Don't clear loading state - backend is still working
        return;
      }
      
      // Handle actual errors
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('MarketScanPage: Search failed:', err);
      setPredictions([]);
      
      // Handle authentication errors
      if (err.message?.includes('Authentication required') || err.message?.includes('Session expired')) {
        setError('Please login to access this feature. Redirecting to login...');
        setLoading(false);
        // Redirect will be handled by API interceptor
        return;
      }
      
      // Connection errors
      if (err.message?.includes('Unable to connect') || err.message?.includes('ECONNREFUSED')) {
        setError('Cannot connect to backend server. Please ensure the backend is running on http://127.0.0.1:8000');
      } else {
        setError(err.message || 'Failed to fetch predictions. Please ensure the backend is running on http://127.0.0.1:8000');
      }
      
      setLoading(false);
      console.error('MarketScanPage: Full error details:', {
        message: err.message,
        response: (error as any)?.response?.data,
        status: (error as any)?.response?.status
      });
    }
  };

  // Removed handleScanAll - not currently used in UI

  const handleAnalyze = async (symbol: string) => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const response = await stockAPI.analyze(symbol, [horizon]);
      
      // Check for errors in metadata
      if (response.metadata?.error) {
        throw new Error(response.metadata.error);
      }
      
      setAnalyzeResults(response);
      // Filter out predictions with errors
      const validPredictions = (response.predictions || []).filter((p: PredictionItem) => !p.error);
      setPredictions(validPredictions);
      
      if (validPredictions.length === 0) {
        setError('Analysis completed but no valid predictions were generated.');
      }
      setLoading(false);
    } catch (error: unknown) {
      // Handle TimeoutError - backend is still processing
      if (error instanceof TimeoutError) {
        // Keep loading state active
        setError(null);
        console.log('MarketScanPage: Analysis timed out but backend is still processing');
        // Don't clear loading - backend is still working
        return;
      }
      
      // Handle actual errors
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Analyze failed:', err);
      setError(err.message || 'Failed to analyze stock. Please ensure the backend is running.');
      setAnalyzeResults(null);
      setLoading(false);
    }
  };

  const handleFeedback = async () => {
    if (!selectedPrediction) {
      console.error('[Feedback] No prediction selected');
      return;
    }
    
    // Validate feedback text
    if (!feedbackText.trim()) {
      setFeedbackError('Please provide feedback text');
      return;
    }
    
    setFeedbackLoading(true);
    setFeedbackError(null);
    
    console.log('[Feedback] Starting feedback submission:', {
      symbol: selectedPrediction.symbol,
      action: selectedPrediction.action,
      feedbackText,
      actualReturn: actualReturn
    });
    
    try {
      // Parse actual_return if provided
      // Backend expects: number | null (not undefined)
      let actualReturnValue: number | null | undefined = undefined;
      if (actualReturn.trim() !== '') {
        const parsed = parseFloat(actualReturn.trim());
        if (isNaN(parsed)) {
          throw new Error('Actual return must be a valid number');
        }
        // Validate range before sending
        if (parsed < -100 || parsed > 1000) {
          throw new Error(`Actual return must be between -100% and 1000%, got: ${parsed}%`);
        }
        actualReturnValue = parsed;
      } else {
        // Empty string means no value - send undefined (will be omitted from payload)
        actualReturnValue = undefined;
      }

      // Map action: LONG -> BUY, SHORT -> SELL, HOLD -> HOLD
      // Also support if action is already BUY/SELL
      let action = selectedPrediction.action?.toUpperCase().trim() || 'HOLD';
      const actionMapping: { [key: string]: string } = {
        'LONG': 'BUY',
        'SHORT': 'SELL',
        'HOLD': 'HOLD'
      };
      // If action is already BUY/SELL, keep it; otherwise map LONG->BUY, SHORT->SELL
      if (actionMapping[action]) {
        action = actionMapping[action];
      }
      
      // Ensure symbol is valid
      const symbol = selectedPrediction.symbol?.trim() || '';
      if (!symbol) {
        throw new Error('Symbol is required');
      }
      
      console.log('[Feedback] Calling API with:', {
        symbol,
        action,
        feedbackText,
        actualReturn: actualReturnValue
      });
      
      const result = await stockAPI.feedback(
        symbol,
        action,
        feedbackText.trim(),
        actualReturnValue
      );
      
      console.log('[Feedback] API response:', result);

      // Check for validation warnings from backend
      if (result.validation_warning) {
        setFeedbackError(result.validation_warning);
        if (result.suggested_feedback) {
          setFeedbackError(`${result.validation_warning}\n\nSuggested feedback: ${result.suggested_feedback}`);
        }
        setFeedbackLoading(false);
        return;
      }

      // Success
      setShowFeedbackModal(false);
      setSelectedPrediction(null);
      setActualReturn('');
      setFeedbackText('');
      setFeedbackError(null);
      
      // Show success message with feedback stats if available
      const statsMsg = result.feedback_stats 
        ? `\n\nTotal feedback: ${result.feedback_stats.total_feedback_count || 0}\nSymbol feedback: ${result.feedback_stats.symbol_feedback_count || 0}`
        : '';
      alert(`Feedback submitted successfully!${statsMsg}`);
    } catch (error: any) {
      console.error('[Feedback] Error caught:', error);
      console.error('[Feedback] Error details:', {
        message: error.message,
        response: error.response,
        responseData: error.response?.data,
        responseStatus: error.response?.status,
        stack: error.stack
      });
      
      // Handle different error types
      let errorMessage = 'Failed to submit feedback';
      
      if (error.response?.data) {
        const responseData = error.response.data;
        console.log('[Feedback] Response data:', responseData);
        
        if (responseData.detail) {
          const detail = responseData.detail;
          
          if (typeof detail === 'string') {
            errorMessage = detail;
          } else if (Array.isArray(detail)) {
            // Pydantic validation errors (422)
            const validationErrors = detail.map((err: any) => {
              const field = err.loc?.join('.') || 'unknown';
              return `${field}: ${err.msg}`;
            });
            errorMessage = `Validation errors:\n${validationErrors.join('\n')}`;
            console.error('[Feedback] Validation errors:', validationErrors);
          } else if (typeof detail === 'object') {
            // Structured error response
            if (detail.error) {
              errorMessage = detail.error;
            }
            if (detail.validation_warning) {
              errorMessage += (errorMessage ? '\n\n' : '') + detail.validation_warning;
            }
            if (detail.suggested_feedback) {
              errorMessage += (errorMessage ? '\n\n' : '') + `Suggested: ${detail.suggested_feedback}`;
            }
          }
        } else if (responseData.error) {
          errorMessage = responseData.error;
        } else if (responseData.message) {
          errorMessage = responseData.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
        console.error('[Feedback] Error message:', errorMessage);
      }
      
      console.error('[Feedback] Final error message:', errorMessage);
      setFeedbackError(errorMessage);
    } finally {
      setFeedbackLoading(false);
      console.log('[Feedback] Feedback submission completed');
    }
  };

  // Removed toggleSymbol - not currently used in UI

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
        return <Minus className="w-5 h-5 text-yellow-400" />;
    }
  };

  // Render appropriate view based on asset type
  const renderAssetView = () => {
    if (assetType === 'stocks') {
      return (
        <StocksView
          onSearch={handleSearch}
          onAnalyze={handleAnalyze}
          predictions={predictions}
          loading={loading}
          error={error}
          horizon={horizon}
          onHorizonChange={setHorizon}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />
      );
    } else if (assetType === 'crypto') {
      return (
        <CryptoView
          onSearch={handleSearch}
          onAnalyze={handleAnalyze}
          predictions={predictions}
          loading={loading}
          error={error}
          horizon={horizon}
          onHorizonChange={setHorizon}
        />
      );
    } else if (assetType === 'commodities') {
      return (
        <CommoditiesView
          onSearch={handleSearch}
          onAnalyze={handleAnalyze}
          predictions={predictions}
          loading={loading}
          error={error}
          horizon={horizon}
          onHorizonChange={setHorizon}
        />
      );
    }
    // Default fallback
    return (
      <StocksView
        onSearch={handleSearch}
        onAnalyze={handleAnalyze}
        predictions={predictions}
        loading={loading}
        error={error}
        horizon={horizon}
        onHorizonChange={setHorizon}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />
    );
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Connection Error Banner - Visible at top if backend is not reachable */}
      {error && error.includes('Unable to connect to backend') && (
        <div className="bg-red-900/30 border-2 border-red-500/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-400 font-semibold mb-2">Backend Server Not Running</p>
              <p className="text-red-300 text-sm mb-3">{error}</p>
              <div className="bg-slate-800/50 rounded-lg p-3 mt-2">
                <p className="text-gray-300 text-xs font-medium mb-1">To start the backend server:</p>
                <code className="text-xs text-green-400 block bg-slate-900/50 p-2 rounded">
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
      
      {/* Loading Indicator - Visible at top */}
      {loading && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
          <span className="text-blue-400 font-semibold text-sm">Fetching data from backend...</span>
        </div>
      )}
      
      {/* Asset Type Specific View */}
      {renderAssetView()}
      
      {/* Candlestick Chart */}
      {showChart && chartSymbol && (
        <CandlestickChart 
          symbol={chartSymbol} 
          exchange={assetType === 'stocks' ? 'NSE' : assetType === 'crypto' ? 'CRYPTO' : 'COMMODITY'}
          onClose={() => {
            setShowChart(false);
            setChartSymbol(null);
          }}
          onPriceUpdate={(price) => {
            // Update predictions with live price for stop-loss panel
            setPredictions(prev => prev.map(p => 
              p.symbol === chartSymbol 
                ? { ...p, current_price: price, predicted_price: price }
                : p
            ));
          }}
        />
      )}
      
      {/* Stop-Loss Calculator - Only shown when chart is active */}
      {chartSymbol && (
        <StopLoss 
          chartSymbol={chartSymbol}
          chartPrice={predictions.find(p => p.symbol === chartSymbol)?.current_price || predictions.find(p => p.symbol === chartSymbol)?.predicted_price || null}
          onClose={() => {
            // Stop-loss panel closed - keep chart open
          }}
        />
      )}
        
      {/* Detailed Predictions Section (shown for all asset types when predictions exist) */}
        {predictions.length > 0 && (
          <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg p-3 border border-slate-700/50 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                Predictions
                <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full text-xs font-semibold">
                  {predictions.length}
                </span>
              </h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {predictions.map((pred, index) => {
                const confidence = (pred.confidence || 0) * 100;
                const isPositive = (pred.predicted_return || 0) > 0;
                const isExpanded = expandedPredictions.has(index);
                const ensembleDetails = (pred.ensemble_details || {}) as Record<string, unknown>;
                const individualPreds = (pred.individual_predictions || {}) as Record<string, {
                  action: string;
                  predicted_return: number;
                  confidence: number;
                  price?: number;
                  return?: number;
                  [key: string]: unknown;
                }>;
                const horizonDetails = (pred.horizon_details || {}) as Record<string, unknown>;
                
                return (
                  <div 
                    key={index} 
                    className="bg-gradient-to-br from-slate-700/50 to-slate-600/30 rounded-lg p-3 border border-slate-600/50 hover:border-blue-500/50 transition-all card-hover group"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {/* Main Prediction Card */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-2">
                        <div className={`p-2 rounded ${
                          pred.action === 'LONG' ? 'bg-green-500/20 border border-green-500/50' :
                          pred.action === 'SHORT' ? 'bg-red-500/20 border border-red-500/50' :
                          'bg-yellow-500/20 border border-yellow-500/50'
                        }`}>
                          {getActionIcon(pred.action)}
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-bold text-sm mb-1">{pred.symbol}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                              pred.action === 'LONG' ? 'bg-green-500/20 text-green-400' :
                              pred.action === 'SHORT' ? 'bg-red-500/20 text-red-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {pred.action === 'LONG' ? 'BUY' : pred.action === 'SHORT' ? 'SELL' : pred.action || 'HOLD'}
                            </span>
                            <span className="text-xs text-gray-400 bg-slate-600/50 px-2 py-1 rounded-lg capitalize">
                              {pred.horizon || horizon}
                            </span>
                            {pred.risk_profile && (
                              <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded-lg capitalize">
                                {pred.risk_profile}
                              </span>
                            )}
                          </div>
                          {pred.current_price && (
                            <p className="text-gray-400 text-xs mt-2">
                              Current: <span className="text-white font-semibold">${pred.current_price.toFixed(2)}</span>
                            </p>
                          )}
                          {pred.model_version && (
                            <p className="text-gray-500 text-xs mt-1">
                              <Brain className="w-3 h-3 inline mr-1" />
                              {pred.model_version}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold text-sm mb-1">
                          ${(pred.predicted_price || pred.current_price || 0).toFixed(2)}
                        </p>
                        <div className="flex items-center gap-1.5 justify-end mb-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            confidence > 70 ? 'bg-green-400' :
                            confidence > 50 ? 'bg-yellow-400' :
                            'bg-red-400'
                          } animate-pulse`}></div>
                          <p className={`text-xs font-semibold ${
                            confidence > 70 ? 'text-green-400' :
                            confidence > 50 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {confidence.toFixed(0)}% confidence
                          </p>
                        </div>
                        {pred.predicted_return !== undefined && (
                          <div className={`flex items-center gap-1 justify-end ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            <p className="text-sm font-bold">
                              {isPositive ? '+' : ''}{pred.predicted_return.toFixed(2)}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {pred.reason && (
                      <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
                        <p className="text-gray-300 text-sm leading-relaxed">{pred.reason}</p>
                      </div>
                    )}
                    
                    {/* Expandable Details Section */}
                    <button
                      onClick={() => {
                        const newExpanded = new Set(expandedPredictions);
                        if (isExpanded) {
                          newExpanded.delete(index);
                        } else {
                          newExpanded.add(index);
                        }
                        setExpandedPredictions(newExpanded);
                      }}
                      className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800/70 rounded-lg transition-colors mb-3"
                    >
                      <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        {isExpanded ? 'Hide' : 'Show'} Detailed Analysis
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>
                    
                    {isExpanded && (
                      <div className="space-y-4 mt-4 border-t border-slate-600/50 pt-4">
                        {/* Ensemble Details */}
                        {Object.keys(ensembleDetails).length > 0 && (
                          <div className="bg-slate-800/50 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                              <Brain className="w-4 h-4 text-purple-400" />
                              Ensemble Analysis
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                              {typeof ensembleDetails.decision_maker === 'string' && ensembleDetails.decision_maker && (
                                <div>
                                  <p className="text-xs text-gray-400 mb-1">Decision Maker</p>
                                  <p className="text-sm text-white font-medium">{ensembleDetails.decision_maker}</p>
                                </div>
                              )}
                              {ensembleDetails.models_align !== undefined && (
                                <div>
                                  <p className="text-xs text-gray-400 mb-1">Models Alignment</p>
                                  <p className={`text-sm font-medium ${ensembleDetails.models_align ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {ensembleDetails.models_align ? '✓ Aligned' : '⚠ Disagreement'}
                                  </p>
                                </div>
                              )}
                              {ensembleDetails.price_agreement !== undefined && (
                                <div>
                                  <p className="text-xs text-gray-400 mb-1">Price Agreement</p>
                                  <p className={`text-sm font-medium ${ensembleDetails.price_agreement ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {ensembleDetails.price_agreement ? '✓ Agreed' : '⚠ Varied'}
                                  </p>
                                </div>
                              )}
                              {ensembleDetails.total_vote !== undefined && typeof ensembleDetails.total_vote === 'number' && (
                                <div>
                                  <p className="text-xs text-gray-400 mb-1">Total Vote</p>
                                  <p className="text-sm text-white font-medium">{Number(ensembleDetails.total_vote).toFixed(4)}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Individual Model Predictions */}
                        {Object.keys(individualPreds).length > 0 && (
                          <div className="bg-slate-800/50 rounded p-2">
                            <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
                              <Cpu className="w-3 h-3 text-blue-400" />
                              Individual Model Predictions
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                              {individualPreds.random_forest && (
                                <div className="bg-slate-700/50 rounded p-2">
                                  <p className="text-xs text-gray-400 mb-1">Random Forest</p>
                                  <p className="text-sm text-white font-medium">${individualPreds.random_forest.price?.toFixed(2) || 'N/A'}</p>
                                  {individualPreds.random_forest.return !== undefined && (
                                    <p className={`text-xs ${individualPreds.random_forest.return > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                      {individualPreds.random_forest.return > 0 ? '+' : ''}{individualPreds.random_forest.return.toFixed(2)}%
                                    </p>
                                  )}
                                </div>
                              )}
                              {individualPreds.lightgbm && (
                                <div className="bg-slate-700/50 rounded p-2">
                                  <p className="text-xs text-gray-400 mb-1">LightGBM</p>
                                  <p className="text-sm text-white font-medium">${individualPreds.lightgbm.price?.toFixed(2) || 'N/A'}</p>
                                  {individualPreds.lightgbm.return !== undefined && (
                                    <p className={`text-xs ${individualPreds.lightgbm.return > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                      {individualPreds.lightgbm.return > 0 ? '+' : ''}{individualPreds.lightgbm.return.toFixed(2)}%
                                    </p>
                                  )}
                                </div>
                              )}
                              {individualPreds.xgboost && (
                                <div className="bg-slate-700/50 rounded p-2">
                                  <p className="text-xs text-gray-400 mb-1">XGBoost</p>
                                  <p className="text-sm text-white font-medium">${individualPreds.xgboost.price?.toFixed(2) || 'N/A'}</p>
                                  {individualPreds.xgboost.return !== undefined && (
                                    <p className={`text-xs ${individualPreds.xgboost.return > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                      {individualPreds.xgboost.return > 0 ? '+' : ''}{individualPreds.xgboost.return.toFixed(2)}%
                                    </p>
                                  )}
                                </div>
                              )}
                              {individualPreds.dqn && (
                                <div className="bg-slate-700/50 rounded p-2">
                                  <p className="text-xs text-gray-400 mb-1">DQN (RL)</p>
                                  <p className="text-sm text-white font-medium">
                                    {individualPreds.dqn.action || 'N/A'}
                                  </p>
                                  {individualPreds.dqn.confidence !== undefined && (
                                    <p className="text-xs text-blue-400">
                                      {(individualPreds.dqn.confidence * 100).toFixed(1)}% confidence
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Horizon Details */}
                        {Object.keys(horizonDetails).length > 0 && (
                          <div className="bg-slate-800/50 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                              <Zap className="w-4 h-4 text-yellow-400" />
                              Horizon Information
                            </h4>
                            <div className="space-y-2">
                              {typeof horizonDetails.description === 'string' && horizonDetails.description && (
                                <p className="text-xs text-gray-300">{horizonDetails.description}</p>
                              )}
                              {horizonDetails.target_days !== undefined && horizonDetails.target_days !== null && (
                                <p className="text-xs text-gray-400">
                                  Target Days: <span className="text-white">{String(horizonDetails.target_days)}</span>
                                </p>
                              )}
                              {typeof horizonDetails.type === 'string' && horizonDetails.type && (
                                <p className="text-xs text-gray-400">
                                  Type: <span className="text-white capitalize">{horizonDetails.type}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Warnings */}
                        {pred.warnings && pred.warnings.length > 0 && (
                          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                            <p className="text-xs font-semibold text-yellow-400 mb-2">⚠ Warnings</p>
                            <ul className="list-disc list-inside space-y-1">
                              {pred.warnings.map((warning: string, i: number) => (
                                <li key={i} className="text-xs text-yellow-300">{warning}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => {
                          setChartSymbol(pred.symbol);
                          setShowChart(true);
                        }}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500/20 to-green-600/20 hover:from-green-500/30 hover:to-green-600/30 border border-green-500/50 text-green-400 text-sm rounded-lg transition-all font-medium flex items-center justify-center gap-2 hover:scale-105"
                      >
                        <BarChart3 className="w-4 h-4" />
                        <span>View Chart</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPrediction(pred);
                          setActualReturn('');
                          setFeedbackText('');
                          setFeedbackError(null);
                          setShowFeedbackModal(true);
                        }}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30 border border-blue-500/50 text-blue-400 text-sm rounded-lg transition-all font-medium flex items-center justify-center gap-2 hover:scale-105"
                      >
                        <ThumbsUp className="w-4 h-4" />
                        <span>Provide Feedback</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {analyzeResults && analyzeResults.metadata && (
          <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/20 backdrop-blur-sm rounded-lg p-3 border border-blue-500/30 shadow-xl">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              Deep Analysis Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-slate-800/50 rounded p-2 border border-slate-700/50">
                <p className="text-gray-400 text-xs mb-1 font-medium">Consensus</p>
                <p className="text-white font-bold text-sm">{analyzeResults.metadata.consensus || 'N/A'}</p>
              </div>
              <div className="bg-slate-800/50 rounded p-2 border border-slate-700/50">
                <p className="text-gray-400 text-xs mb-1 font-medium">Average Confidence</p>
                <p className="text-white font-bold text-sm">
                  {analyzeResults.metadata.average_confidence 
                    ? (analyzeResults.metadata.average_confidence * 100).toFixed(1) + '%'
                    : 'N/A'}
                </p>
              </div>
              <div className="bg-slate-800/50 rounded p-2 border border-slate-700/50">
                <p className="text-gray-400 text-xs mb-1 font-medium">Horizons Analyzed</p>
                <p className="text-white font-bold text-sm capitalize">
                  {analyzeResults.metadata.horizons?.join(', ') || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}

        {showFeedbackModal && selectedPrediction && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 max-w-md w-full shadow-2xl animate-slideIn">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ThumbsUp className="w-5 h-5 text-blue-400" />
                  Provide Feedback
                </h3>
                <button
                  onClick={() => {
                    setShowFeedbackModal(false);
                    setSelectedPrediction(null);
                    setActualReturn('');
                    setFeedbackText('');
                    setFeedbackError(null);
                  }}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                  disabled={feedbackLoading}
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Prediction Info Card */}
              <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 rounded-lg p-4 mb-4 border border-slate-600/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-white">{selectedPrediction.symbol}</span>
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                      selectedPrediction.action?.toUpperCase() === 'LONG' || selectedPrediction.action?.toUpperCase() === 'BUY' ? 'bg-green-500/20 text-green-400 border border-green-500/50' :
                      selectedPrediction.action?.toUpperCase() === 'SHORT' || selectedPrediction.action?.toUpperCase() === 'SELL' ? 'bg-red-500/20 text-red-400 border border-red-500/50' :
                      'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                    }`}>
                      {selectedPrediction.action?.toUpperCase() === 'LONG' ? 'BUY' :
                       selectedPrediction.action?.toUpperCase() === 'SHORT' ? 'SELL' :
                       selectedPrediction.action?.toUpperCase() || 'HOLD'}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Current Price</p>
                    <p className="text-sm font-semibold text-white">
                      ${(selectedPrediction.current_price || 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Predicted Price</p>
                    <p className="text-sm font-semibold text-blue-400">
                      ${(selectedPrediction.predicted_price || selectedPrediction.current_price || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
                {selectedPrediction.predicted_return !== undefined && (
                  <div className="mt-2 pt-2 border-t border-slate-600/50">
                    <p className="text-xs text-gray-400 mb-1">Predicted Return</p>
                    <p className={`text-sm font-bold ${
                      selectedPrediction.predicted_return >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {selectedPrediction.predicted_return >= 0 ? '+' : ''}
                      {selectedPrediction.predicted_return.toFixed(2)}%
                    </p>
                  </div>
                )}
              </div>

              {/* User Feedback Text Input (Required) */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-300 mb-2">
                  Your Feedback <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="e.g., Model suggested BUY but price reversed after entry"
                  rows={4}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none"
                  disabled={feedbackLoading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Describe your feedback about this prediction (e.g., "correct", "incorrect", "price reversed", etc.)
                </p>
              </div>

              {/* Actual Return Input (Optional) */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-300 mb-2">
                  Actual Return % <span className="text-gray-500">(Optional)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="-100"
                  max="1000"
                  value={actualReturn}
                  onChange={(e) => setActualReturn(e.target.value)}
                  placeholder="e.g., 5.25 or -2.10"
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  disabled={feedbackLoading}
                />
                <p className="text-xs text-gray-500 mt-1">Range: -100% to 1000%</p>
              </div>

              {/* Error Message */}
              {feedbackError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-300 whitespace-pre-line">{feedbackError}</p>
                  </div>
                </div>
              )}

              {/* Submit and Cancel Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleFeedback}
                  disabled={feedbackLoading || !feedbackText.trim()}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-blue-500/50 disabled:to-blue-600/50 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-blue-500/50"
                >
                  {feedbackLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <ThumbsUp className="w-4 h-4" />
                      <span>Submit Feedback</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowFeedbackModal(false);
                    setSelectedPrediction(null);
                    setActualReturn('');
                    setFeedbackText('');
                    setFeedbackError(null);
                  }}
                  disabled={feedbackLoading}
                  className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700/50 disabled:cursor-not-allowed text-white rounded-lg transition-all text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

// Outer component that wraps with Layout
const MarketScanPage = () => {
  return (
    <Layout>
      <MarketScanContent />
    </Layout>
  );
};

export default MarketScanPage;


