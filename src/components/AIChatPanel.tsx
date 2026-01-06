import { useState, useRef, useEffect } from 'react';
import { Send, X, Minimize2, Bot, User, Loader2, Sparkles, AlertCircle, Zap, TrendingUp, BarChart3, HelpCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLocation } from 'react-router-dom';
import { useAssetType } from '../contexts/AssetTypeContext';
import { aiAPI } from '../services/api';

interface AIChatPanelProps {
  onClose: () => void;
  onMinimize: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  error?: boolean;
}

const QUICK_ACTIONS = [
  { label: 'Market Analysis', icon: BarChart3, prompt: 'Analyze current market trends and provide insights' },
  { label: 'Trading Strategy', icon: TrendingUp, prompt: 'Suggest a trading strategy for current market conditions' },
  { label: 'Technical Indicators', icon: Zap, prompt: 'Explain technical indicators and how to use them' },
  { label: 'Risk Management', icon: HelpCircle, prompt: 'How should I manage risk in my trades?' },
];

const AIChatPanel = ({ onClose, onMinimize }: AIChatPanelProps) => {
  const { theme } = useTheme();
  const location = useLocation();
  const { assetType } = useAssetType();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isLight = theme === 'light';
  const isSpace = theme === 'space';

  // Get context from URL or current page
  const getContext = () => {
    const context: { symbol?: string; timeframe?: string; activeIndicators?: string[] } = {};
    
    // Try to get symbol from URL params
    const urlParams = new URLSearchParams(location.search);
    const symbol = urlParams.get('q') || urlParams.get('symbol');
    if (symbol) {
      context.symbol = symbol;
    }
    
    // Add asset type to context
    if (assetType) {
      context.activeIndicators = context.activeIndicators || [];
      context.activeIndicators.push(`AssetType: ${assetType}`);
    }
    
    return context;
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSend = async (messageContent?: string, contextOverride?: typeof getContext extends () => infer R ? R : never) => {
    const content = messageContent || input.trim();
    if (!content || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!messageContent) setInput('');
    setIsLoading(true);
    setError(null);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      // Get context for the request
      const context = contextOverride || getContext();

      // Backend API call - ready for integration
      // When backend is ready, uncomment this and remove the setTimeout block
      /*
      const response = await aiAPI.chat(content, context);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message || response.content || 'I received your message.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
      */

      // Simulated response for now (remove when backend is ready)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Thank you for your message: "${content}". The AI backend is currently being set up. Once ready, I'll be able to provide real-time trading insights, market analysis, and answer your questions about ${context.symbol ? `the ${context.symbol} symbol` : 'trading'}.\n\nFor now, here's a placeholder response demonstrating the chat interface.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      if (error.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      console.error('AI Chat Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message || 'Unable to process your request. Please try again.'}`,
        timestamp: new Date(),
        error: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
      setError(error.message || 'Failed to get response');
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleQuickAction = (prompt: string) => {
    handleSend(prompt);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getThemeClasses = () => {
    if (isLight) {
      return {
        bg: 'bg-white',
        bgSecondary: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-900',
        textSecondary: 'text-gray-600',
        textTertiary: 'text-gray-400',
        input: 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500',
        messageUser: 'bg-blue-500 text-white',
        messageBot: 'bg-gray-100 text-gray-900',
        header: 'bg-white border-gray-200',
      };
    }
    if (isSpace) {
      return {
        bg: 'bg-slate-900/95 backdrop-blur-sm',
        bgSecondary: 'bg-slate-800/60',
        border: 'border-purple-900/30',
        text: 'text-white',
        textSecondary: 'text-gray-300',
        textTertiary: 'text-gray-400',
        input: 'bg-slate-800/60 backdrop-blur-sm border-purple-900/30 text-white placeholder-gray-300',
        messageUser: 'bg-blue-500 text-white',
        messageBot: 'bg-slate-700/80 text-gray-100',
        header: 'bg-slate-900/95 backdrop-blur-sm border-purple-900/30',
      };
    }
    return {
      bg: 'bg-slate-800/95 backdrop-blur-sm',
      bgSecondary: 'bg-slate-700/50',
      border: 'border-slate-700',
      text: 'text-white',
      textSecondary: 'text-gray-300',
      textTertiary: 'text-gray-400',
      input: 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-400',
      messageUser: 'bg-blue-500 text-white',
      messageBot: 'bg-slate-700 text-gray-100',
      header: 'bg-slate-800/95 backdrop-blur-sm border-slate-700',
    };
  };

  const themeClasses = getThemeClasses();

  return (
    <div className={`fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[420px] sm:h-[650px] h-full sm:rounded-xl ${themeClasses.bg} ${themeClasses.border} border shadow-2xl z-50 flex flex-col`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${themeClasses.header} ${themeClasses.border}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center relative shadow-lg ${
            isSpace ? 'shadow-blue-500/50' : ''
          }`}>
            {!imageError ? (
              <img
                src="/jarvis-logo.png"
                alt="AI"
                className="w-6 h-6 object-contain"
                onError={() => setImageError(true)}
              />
            ) : (
              <Bot className="w-5 h-5 text-white" />
            )}
            {isLoading && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse border-2 border-white"></div>
            )}
          </div>
          <div>
            <h3 className={`text-sm font-semibold ${themeClasses.text} flex items-center gap-1`}>
              AI Trading Assistant
              {isSpace && <Sparkles className="w-3 h-3 text-purple-400" />}
            </h3>
            <p className={`text-xs ${themeClasses.textTertiary}`}>
              {isLoading ? 'Thinking...' : 'Ready to help'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMinimize}
            className={`p-1.5 hover:bg-opacity-20 rounded transition-colors ${themeClasses.textSecondary}`}
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className={`p-1.5 hover:bg-opacity-20 rounded transition-colors ${themeClasses.textSecondary}`}
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${themeClasses.bgSecondary}`}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className={`w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center mb-4 ${
              isSpace ? 'shadow-lg shadow-purple-500/20' : ''
            }`}>
              {!imageError ? (
                <img
                  src="/jarvis-logo.png"
                  alt="AI"
                  className="w-12 h-12 object-contain opacity-70"
                  onError={() => setImageError(true)}
                />
              ) : (
                <Bot className="w-12 h-12 text-blue-400 opacity-70" />
              )}
            </div>
            <h4 className={`text-base font-semibold ${themeClasses.text} mb-2`}>
              AI Trading Assistant
            </h4>
            <p className={`text-sm ${themeClasses.textSecondary} max-w-xs mb-6`}>
              Ask me about market analysis, trading strategies, or get help with your charts.
            </p>
            
            {/* Quick Actions */}
            <div className="w-full space-y-2">
              <p className={`text-xs font-medium ${themeClasses.textTertiary} mb-2`}>Quick Actions:</p>
              {QUICK_ACTIONS.map((action, idx) => {
                const Icon = action.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleQuickAction(action.prompt)}
                    disabled={isLoading}
                    className={`w-full px-4 py-2.5 rounded-lg text-left flex items-center gap-3 transition-all ${
                      isLight
                        ? 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-200'
                        : isSpace
                          ? 'bg-slate-800/80 hover:bg-slate-700/80 text-white border border-purple-900/30 hover:border-purple-700/50'
                          : 'bg-slate-700/50 hover:bg-slate-600/50 text-gray-100 border border-slate-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Icon className={`w-4 h-4 ${isSpace ? 'text-purple-400' : 'text-blue-400'}`} />
                    <span className="text-sm">{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center flex-shrink-0 ${
                    isSpace ? 'shadow-md shadow-purple-500/20' : ''
                  }`}>
                    {!imageError ? (
                      <img
                        src="/jarvis-logo.png"
                        alt="AI"
                        className="w-5 h-5 object-contain"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <Bot className={`w-5 h-5 ${isSpace ? 'text-purple-400' : 'text-blue-400'}`} />
                    )}
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl p-3.5 shadow-sm ${
                    message.role === 'user'
                      ? `${themeClasses.messageUser} ${isSpace ? 'shadow-lg shadow-blue-500/30' : ''}`
                      : `${themeClasses.messageBot} ${message.error ? 'border border-red-500/50' : ''}`
                  }`}
                >
                  <p className={`text-sm whitespace-pre-wrap leading-relaxed ${message.error ? 'text-red-400' : ''}`}>
                    {message.content}
                  </p>
                  <p className={`text-xs mt-2 ${message.role === 'user' ? 'opacity-80' : themeClasses.textTertiary}`}>
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                {message.role === 'user' && (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isLight ? 'bg-gray-200' : 'bg-slate-700'
                  }`}>
                    <User className={`w-5 h-5 ${themeClasses.textTertiary}`} />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center flex-shrink-0 ${
                  isSpace ? 'shadow-md shadow-purple-500/20' : ''
                }`}>
                  {!imageError ? (
                    <img
                      src="/jarvis-logo.png"
                      alt="AI"
                      className="w-5 h-5 object-contain"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <Bot className={`w-5 h-5 ${isSpace ? 'text-purple-400' : 'text-blue-400'}`} />
                  )}
                </div>
                <div className={`${themeClasses.messageBot} rounded-xl p-3.5`}>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                    <span className={`text-xs ${themeClasses.textTertiary}`}>Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className={`p-3 rounded-lg border border-red-500/50 bg-red-500/10 flex items-center gap-2 ${themeClasses.text}`}>
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`border-t ${themeClasses.header} ${themeClasses.border} p-3 sm:p-4 flex-shrink-0`}>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about trading..."
            className={`flex-1 px-4 py-2.5 rounded-lg ${themeClasses.input} focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all`}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
              isSpace ? 'shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40' : ''
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
        {messages.length === 0 && (
          <p className={`mt-2 text-xs ${themeClasses.textTertiary} text-center`}>
            Press Enter to send • Shift+Enter for new line
          </p>
        )}
      </div>
    </div>
  );
};

export default AIChatPanel;
