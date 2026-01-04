import { useState, useRef, useEffect } from 'react';
import { Send, X, Minimize2, Bot, User, Loader2 } from 'lucide-react';

interface AIChatPanelProps {
  onClose: () => void;
  onMinimize: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const AIChatPanel = ({ onClose, onMinimize }: AIChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // TODO: Backend API call
    // POST /api/ai/chat
    // Payload: {
    //   message: userMessage.content,
    //   context: {
    //     symbol?: string,  // Current chart symbol if available
    //     timeframe?: string,  // Current timeframe if available
    //     activeIndicators?: string[]  // Active indicators if any
    //   }
    // }

    // Simulate loading delay (remove when backend is ready)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Backend API not yet implemented. This is a placeholder response.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-96 sm:h-[600px] h-full sm:rounded-lg bg-slate-800/95 backdrop-blur-sm border border-slate-700 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center relative">
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
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">AI Assistant</h3>
            <p className="text-xs text-gray-400">Trading Support</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMinimize}
            className="p-1.5 hover:bg-slate-700 rounded transition-colors"
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-700 rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center mb-4">
              {!imageError ? (
                <img
                  src="/jarvis-logo.png"
                  alt="AI"
                  className="w-10 h-10 object-contain opacity-50"
                  onError={() => setImageError(true)}
                />
              ) : (
                <Bot className="w-10 h-10 text-blue-400 opacity-50" />
              )}
            </div>
            <h4 className="text-sm font-semibold text-white mb-2">
              AI Trading Assistant
            </h4>
            <p className="text-xs text-gray-400 max-w-xs">
              Ask me about market analysis, trading strategies, or get help with your charts.
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center flex-shrink-0">
                    {!imageError ? (
                      <img
                        src="/jarvis-logo.png"
                        alt="AI"
                        className="w-6 h-6 object-contain"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <Bot className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-700 text-gray-100'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center flex-shrink-0">
                  {!imageError ? (
                    <img
                      src="/jarvis-logo.png"
                      alt="AI"
                      className="w-6 h-6 object-contain"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <Bot className="w-5 h-5 text-blue-400" />
                  )}
                </div>
                <div className="bg-slate-700 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                    <span className="text-sm text-gray-400">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-700 p-3 sm:p-4 flex-shrink-0">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
            className="flex-1 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
        <div className="mt-2 text-xs text-gray-500 italic">
          {/* TODO: Backend API endpoint: POST /api/ai/chat */}
          {/* Payload: { message, context: { symbol?, timeframe?, activeIndicators?[] } } */}
        </div>
      </div>
    </div>
  );
};

export default AIChatPanel;

