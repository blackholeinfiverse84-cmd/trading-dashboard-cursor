import { useState, useRef, useEffect } from 'react';
import { Search, Bell, User, Sun, Moon, Sparkles, Menu } from 'lucide-react';
import { POPULAR_STOCKS, POPULAR_CRYPTO, POPULAR_COMMODITIES } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import ServerStatusIndicator from './ServerStatusIndicator';
import NotificationCenter from './NotificationCenter';

interface NavbarProps {
  onSearch: (query: string) => void;
  activeTab: 'stocks' | 'crypto' | 'commodities';
  onTabChange: (tab: 'stocks' | 'crypto' | 'commodities') => void;
  onMenuClick?: () => void;
}

const Navbar = ({ onSearch, activeTab, onTabChange, onMenuClick }: NavbarProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSymbols, setFilteredSymbols] = useState<string[]>([]);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const { theme, setTheme } = useTheme();
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Get appropriate symbol list based on active tab
  const getSymbolList = () => {
    if (activeTab === 'stocks') return POPULAR_STOCKS;
    if (activeTab === 'crypto') return POPULAR_CRYPTO;
    if (activeTab === 'commodities') return POPULAR_COMMODITIES;
    return POPULAR_STOCKS;
  };

  const handleSearchChange = (value: string) => {
    try {
      setSearchQuery(value);
      if (value.length > 0) {
        const symbols = getSymbolList();
        const filtered = symbols.filter((symbol) =>
          symbol.toLowerCase().includes(value.toLowerCase())
        ).slice(0, 10);
        setFilteredSymbols(filtered);
        setShowSuggestions(true);
      } else {
        setFilteredSymbols([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error in search change:', error);
      setFilteredSymbols([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectStock = (symbol: string) => {
    try {
      setSearchQuery(symbol);
      setShowSuggestions(false);
      if (onSearch && typeof onSearch === 'function') {
        onSearch(symbol);
      }
    } catch (error) {
      console.error('Error selecting stock:', error);
      setShowSuggestions(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    try {
      e.preventDefault();
      if (searchQuery && onSearch && typeof onSearch === 'function') {
        onSearch(searchQuery);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error submitting search:', error);
      setShowSuggestions(false);
    }
  };

  // Close theme menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setShowThemeMenu(false);
      }
    };

    if (showThemeMenu) {
      // Use setTimeout to avoid immediate closure
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 10);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showThemeMenu]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showSuggestions]);

  // Handle theme change
  const handleThemeChange = (newTheme: 'light' | 'dark' | 'space') => {
    try {
      console.log('Changing theme to:', newTheme);
      if (setTheme && typeof setTheme === 'function') {
        setTheme(newTheme);
      }
      setShowThemeMenu(false);
    } catch (error) {
      console.error('Error changing theme:', error);
      setShowThemeMenu(false);
    }
  };

  const isLight = theme === 'light';
  const isSpace = theme === 'space';

  return (
    <div className={`px-3 sm:px-4 py-2.5 sm:py-3 border-b relative z-30 ${
      isLight 
        ? 'bg-white border-gray-200' 
        : isSpace
          ? 'bg-transparent border-purple-900/20'
          : 'bg-slate-800 border-slate-700'
    }`}>
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        {/* Mobile Menu Button */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className={`lg:hidden p-2 rounded transition-colors flex-shrink-0 ${
              isLight
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-gray-300 hover:bg-slate-700 hover:text-white'
            }`}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        
        {/* Search Container - Fixed z-index and positioning */}
        <div ref={searchContainerRef} className="flex-1 min-w-0 max-w-2xl relative z-40">
          <form onSubmit={handleSubmit} className="relative">
            <Search className={`absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none ${
              isLight ? 'text-gray-500' : isSpace ? 'text-gray-300' : 'text-gray-400'
            }`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => searchQuery && setShowSuggestions(true)}
              onBlur={() => {
                // Delay to allow click on suggestion
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              placeholder="Search stocks, crypto..."
              className={`w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                isLight
                  ? 'bg-gray-100 border border-gray-300 text-gray-900 placeholder-gray-500'
                  : isSpace
                    ? 'bg-slate-800/60 backdrop-blur-sm border border-purple-900/30 text-white placeholder-gray-300'
                    : 'bg-slate-700 border border-slate-600 text-white placeholder-gray-400'
              }`}
            />
            {/* Search Suggestions - Fixed positioning and z-index */}
            {showSuggestions && filteredSymbols.length > 0 && (
              <div 
                className={`absolute top-full left-0 right-0 mt-1 rounded-lg shadow-2xl max-h-60 overflow-y-auto z-[9999] ${
                  isLight
                    ? 'bg-white border-2 border-gray-300'
                    : isSpace
                      ? 'bg-slate-800/98 backdrop-blur-md border-2 border-purple-900/50'
                      : 'bg-slate-700 border-2 border-slate-600'
                }`}
                style={{ 
                  position: 'absolute',
                  zIndex: 9999,
                  top: '100%',
                  left: 0,
                  right: 0,
                }}
              >
                {filteredSymbols.map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectStock(symbol);
                    }}
                    className={`w-full px-3 py-2 text-sm text-left transition-colors hover:bg-opacity-80 ${
                      isLight
                        ? 'text-gray-900 hover:bg-blue-50'
                        : 'text-white hover:bg-slate-600'
                    }`}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          {/* Server Status Indicator - Hidden on very small screens */}
          <ServerStatusIndicator className="hidden md:block" />
          
          {/* Tab Switcher - Responsive */}
          <div className={`flex gap-0.5 sm:gap-1 rounded p-0.5 ${
            isLight ? 'bg-gray-100' : isSpace ? 'bg-slate-800/60 backdrop-blur-sm' : 'bg-slate-700'
          }`}>
            {(['stocks', 'crypto', 'commodities'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onTabChange(tab);
                }}
                className={`px-1.5 sm:px-2.5 py-1 rounded text-[10px] sm:text-xs font-medium transition-colors cursor-pointer relative z-10 ${
                  activeTab === tab
                    ? 'bg-blue-500 text-white shadow-lg'
                    : isLight
                      ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'
                      : 'text-gray-300 hover:text-white hover:bg-slate-600'
                }`}
                title={tab.charAt(0).toUpperCase() + tab.slice(1)}
              >
                <span className="hidden sm:inline">{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                <span className="sm:hidden">{tab.charAt(0).toUpperCase()}</span>
              </button>
            ))}
          </div>

          {/* Notification Center */}
          <div className="hidden sm:block">
            <NotificationCenter />
          </div>

          {/* Theme Switcher - Completely rewritten */}
          <div ref={themeMenuRef} className="relative theme-switcher-container">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowThemeMenu(!showThemeMenu);
              }}
              className={`p-1.5 rounded transition-colors flex items-center gap-1.5 ${
                isLight
                  ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  : isSpace
                    ? 'text-white/90 hover:text-white hover:bg-white/10 drop-shadow'
                    : 'text-gray-300 hover:text-white hover:bg-slate-700'
              }`}
              title="Theme Switcher"
            >
              {theme === 'light' && <Sun className="w-4 h-4" />}
              {theme === 'dark' && <Moon className="w-4 h-4" />}
              {theme === 'space' && <Sparkles className="w-4 h-4" />}
            </button>
            
            {showThemeMenu && (
              <div 
                className={`absolute right-0 mt-2 w-48 rounded-lg shadow-2xl z-[9999] overflow-hidden ${
                  isLight
                    ? 'bg-white border-2 border-gray-300'
                    : isSpace
                      ? 'bg-slate-800/98 backdrop-blur-md border-2 border-purple-900/50'
                      : 'bg-slate-800 border-2 border-slate-700'
                }`}
                style={{ 
                  position: 'absolute',
                  zIndex: 9999,
                }}
              >
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => handleThemeChange('light')}
                    className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors cursor-pointer ${
                      theme === 'light'
                        ? 'bg-blue-500/20 text-blue-600 font-semibold'
                        : isLight
                          ? 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                          : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    <span>Light</span>
                    {theme === 'light' && <span className="ml-auto text-xs font-bold">✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleThemeChange('dark')}
                    className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-blue-500/20 text-blue-400 font-semibold'
                        : isLight
                          ? 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                          : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    <span>Dark</span>
                    {theme === 'dark' && <span className="ml-auto text-xs font-bold">✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleThemeChange('space')}
                    className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors cursor-pointer ${
                      theme === 'space'
                        ? 'bg-blue-500/20 text-blue-400 font-semibold'
                        : isLight
                          ? 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                          : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Space</span>
                    {theme === 'space' && <span className="ml-auto text-xs font-bold">✓</span>}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User - Smaller on mobile */}
          <button className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
            isLight
              ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              : isSpace
                ? 'text-white/90 hover:text-white hover:bg-white/10 drop-shadow'
                : 'text-gray-300 hover:text-white hover:bg-slate-700'
          }`}>
            <User className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
