import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Search, 
  Briefcase, 
  History, 
  Star, 
  BarChart3,
  Bell,
  Settings,
  GitCompare,
  LogOut,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar = ({ isOpen = true, onClose }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { theme } = useTheme();

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/market-scan', icon: Search, label: 'Market Scan' },
    { path: '/portfolio', icon: Briefcase, label: 'Portfolio' },
    { path: '/trading-history', icon: History, label: 'Trading History' },
    { path: '/watchlist', icon: Star, label: 'Watch List' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/alerts', icon: Bell, label: 'Alerts' },
    { path: '/compare', icon: GitCompare, label: 'Compare' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const isLight = theme === 'light';
  const isSpace = theme === 'space';
  
  // Handle navigation click on mobile (close sidebar)
  const handleNavClick = () => {
    if (onClose && window.innerWidth < 1024) {
      onClose();
    }
  };

  // Handle logout and close sidebar on mobile
  const handleLogout = (e?: React.MouseEvent) => {
    // Prevent any default behavior
    e?.preventDefault();
    e?.stopPropagation();
    
    // Clear state first
    logout();
    
    // Close sidebar on mobile
    if (onClose && window.innerWidth < 1024) {
      onClose();
    }
    
    // Navigate immediately using React Router (replace: true prevents back button)
    navigate('/login', { replace: true });
  };
  
  return (
    <>
      {/* Mobile overlay */}
      {onClose && (
        <div
          className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 lg:hidden ${
            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed lg:static top-0 left-0 h-screen flex flex-col relative z-50
        w-64 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isLight 
          ? 'bg-white border-r border-gray-200' 
          : isSpace
            ? 'bg-slate-900/95 backdrop-blur-md border-r border-purple-900/20'
            : 'bg-slate-900 border-r border-slate-700'
        }
      `}>
        {/* Mobile header with close button */}
        {onClose && (
          <div className={`flex items-center justify-between p-3 border-b lg:hidden ${
            isLight 
              ? 'border-gray-200' 
              : isSpace 
                ? 'border-purple-900/20' 
                : 'border-slate-700'
          }`}>
            <h1 className={`text-lg font-bold ${
              isLight 
                ? 'text-gray-900' 
                : isSpace 
                  ? 'text-white drop-shadow-lg' 
                  : 'text-white'
            }`}>Menu</h1>
            <button
              onClick={onClose}
              className={`p-1.5 rounded transition-colors ${
                isLight
                  ? 'text-gray-600 hover:bg-gray-100'
                  : 'text-gray-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      <div className={`p-3 border-b hidden lg:block ${
        isLight 
          ? 'border-gray-200' 
          : isSpace 
            ? 'border-purple-900/20' 
            : 'border-slate-700'
      }`}>
        <h1 className={`text-lg font-bold ${
          isLight 
            ? 'text-gray-900' 
            : isSpace 
              ? 'text-white drop-shadow-lg' 
              : 'text-white'
        }`}>Trading Hub</h1>
        <p className={`text-xs mt-0.5 ${
          isLight 
            ? 'text-gray-600' 
            : isSpace 
              ? 'text-gray-200 drop-shadow' 
              : 'text-gray-400'
        }`}>Welcome, {user?.username || 'anonymous'}</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={`flex items-center gap-2 px-3 py-2.5 rounded transition-colors ${
                isActive
                  ? 'bg-blue-500 text-white'
                  : isLight
                    ? 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    : isSpace
                      ? 'text-white/90 hover:bg-white/10 hover:text-white drop-shadow'
                      : 'text-gray-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={`p-3 border-t ${
        isLight 
          ? 'border-gray-200' 
          : isSpace 
            ? 'border-purple-900/20' 
            : 'border-slate-700'
      }`}>
        <button
          onClick={handleLogout}
          className={`flex items-center gap-2 px-3 py-2.5 w-full rounded transition-colors ${
            isLight
              ? 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              : isSpace
                ? 'text-white/90 hover:bg-white/10 hover:text-white drop-shadow'
                : 'text-gray-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium text-sm">Logout</span>
        </button>
      </div>
      </div>
    </>
  );
};

export default Sidebar;

