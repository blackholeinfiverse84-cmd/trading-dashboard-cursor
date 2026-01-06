import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Settings, RefreshCw, Moon, Sun, Sparkles, Bell, Download, Trash2, Save } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationContext';
import { notificationSettingsService, NotificationSettings } from '../services/alertsService';

interface UserPreferences {
  refreshInterval: number; // in seconds
  defaultHorizon: 'intraday' | 'short' | 'long';
  autoRefresh: boolean;
  showHealthStatus: boolean;
  itemsPerPage: number;
}

const defaultPreferences: UserPreferences = {
  refreshInterval: 120,
  defaultHorizon: 'intraday',
  autoRefresh: true,
  showHealthStatus: true,
  itemsPerPage: 20,
};

const SettingsPage = () => {
  const { theme, setTheme } = useTheme();
  const { settings: notificationSettings, updateSettings: updateNotificationSettings } = useNotifications();
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = () => {
    try {
      const stored = localStorage.getItem('user_preferences');
      if (stored) {
        setPreferences({ ...defaultPreferences, ...JSON.parse(stored) });
      }
    } catch {
      // Use defaults
    }
  };

  const savePreferences = () => {
    localStorage.setItem('user_preferences', JSON.stringify(preferences));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const clearAllData = () => {
    if (confirm('Are you sure you want to clear all local data? This will remove your portfolio, watchlist, alerts, and preferences.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const exportData = () => {
    const data = {
      preferences,
      portfolio: localStorage.getItem('portfolio_holdings'),
      watchlist: localStorage.getItem('watchlist'),
      alerts: {
        price: localStorage.getItem('price_alerts'),
        prediction: localStorage.getItem('prediction_alerts'),
      },
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-dashboard-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Settings
          </h1>
          <p className="text-gray-400 text-sm">Manage your preferences and application settings</p>
        </div>

        {/* Appearance */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            {theme === 'light' ? <Sun className="w-5 h-5" /> : theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            Appearance
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Theme</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                    theme === 'light'
                      ? 'border-blue-500 bg-blue-500/20 text-white'
                      : 'border-slate-600 bg-slate-700 text-gray-300 hover:border-slate-500'
                  }`}
                >
                  <Sun className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-sm font-medium">Light</span>
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                    theme === 'dark'
                      ? 'border-blue-500 bg-blue-500/20 text-white'
                      : 'border-slate-600 bg-slate-700 text-gray-300 hover:border-slate-500'
                  }`}
                >
                  <Moon className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-sm font-medium">Dark</span>
                </button>
                <button
                  onClick={() => setTheme('space')}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                    theme === 'space'
                      ? 'border-blue-500 bg-blue-500/20 text-white'
                      : 'border-slate-600 bg-slate-700 text-gray-300 hover:border-slate-500'
                  }`}
                >
                  <Sparkles className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-sm font-medium">Space</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Browser Notifications</p>
                <p className="text-gray-400 text-sm">Receive browser notifications for alerts</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationSettings.browserNotifications}
                  onChange={(e) => updateNotificationSettings({ browserNotifications: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Price Alerts</p>
                <p className="text-gray-400 text-sm">Notify when price alerts trigger</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationSettings.priceAlerts}
                  onChange={(e) => updateNotificationSettings({ priceAlerts: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Prediction Alerts</p>
                <p className="text-gray-400 text-sm">Notify when prediction alerts trigger</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationSettings.predictionAlerts}
                  onChange={(e) => updateNotificationSettings({ predictionAlerts: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Preferences
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Auto-Refresh Interval (seconds)</label>
              <input
                type="number"
                value={preferences.refreshInterval}
                onChange={(e) => setPreferences({ ...preferences, refreshInterval: parseInt(e.target.value) || 120 })}
                min="30"
                max="600"
                step="30"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-gray-400 text-xs mt-1">How often to automatically refresh data (30-600 seconds)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Default Prediction Horizon</label>
              <select
                value={preferences.defaultHorizon}
                onChange={(e) => setPreferences({ ...preferences, defaultHorizon: e.target.value as any })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="intraday">Intraday</option>
                <option value="short">Short Term</option>
                <option value="long">Long Term</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Auto-Refresh</p>
                <p className="text-gray-400 text-sm">Automatically refresh data at intervals</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.autoRefresh}
                  onChange={(e) => setPreferences({ ...preferences, autoRefresh: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Items Per Page</label>
              <input
                type="number"
                value={preferences.itemsPerPage}
                onChange={(e) => setPreferences({ ...preferences, itemsPerPage: parseInt(e.target.value) || 20 })}
                min="10"
                max="100"
                step="10"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={savePreferences}
              className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saved ? 'Saved!' : 'Save Preferences'}
            </button>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Download className="w-5 h-5" />
            Data Management
          </h2>
          <div className="space-y-4">
            <button
              onClick={exportData}
              className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Export All Data
            </button>
            <button
              onClick={clearAllData}
              className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-5 h-5" />
              Clear All Data
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SettingsPage;




