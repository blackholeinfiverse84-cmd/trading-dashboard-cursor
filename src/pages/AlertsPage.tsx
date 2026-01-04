import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Bell, Plus, X, Trash2, TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react';
import { priceAlertsService, predictionAlertsService, requestNotificationPermission } from '../services/alertsService';
import { PriceAlert, PredictionAlert } from '../types/alerts';
import { stockAPI, POPULAR_STOCKS } from '../services/api';
import { useNotifications } from '../contexts/NotificationContext';

const AlertsPage = () => {
  const { addNotification } = useNotifications();
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [predictionAlerts, setPredictionAlerts] = useState<PredictionAlert[]>([]);
  const [showPriceAlertModal, setShowPriceAlertModal] = useState(false);
  const [showPredictionAlertModal, setShowPredictionAlertModal] = useState(false);
  const [newPriceAlert, setNewPriceAlert] = useState({
    symbol: '',
    type: 'above' as 'above' | 'below' | 'change',
    targetPrice: '',
    changePercent: '',
  });
  const [newPredictionAlert, setNewPredictionAlert] = useState({
    symbol: '',
    action: 'LONG' as 'LONG' | 'SHORT' | 'HOLD',
  });
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    loadAlerts();
    checkNotificationPermission();
  }, []);

  const loadAlerts = () => {
    setPriceAlerts(priceAlertsService.getAll());
    setPredictionAlerts(predictionAlertsService.getAll());
  };

  const checkNotificationPermission = async () => {
    if ('Notification' in window) {
      setBrowserNotificationPermission(Notification.permission);
    }
  };

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setBrowserNotificationPermission('granted');
      addNotification({
        type: 'system',
        title: 'Notifications Enabled',
        message: 'You will now receive browser notifications for your alerts.',
      });
    }
  };

  const handleAddPriceAlert = () => {
    if (!newPriceAlert.symbol) {
      alert('Please enter a symbol');
      return;
    }

    if (newPriceAlert.type !== 'change' && !newPriceAlert.targetPrice) {
      alert('Please enter a target price');
      return;
    }

    if (newPriceAlert.type === 'change' && !newPriceAlert.changePercent) {
      alert('Please enter a change percentage');
      return;
    }

    const alert = priceAlertsService.add({
      symbol: newPriceAlert.symbol.toUpperCase(),
      type: newPriceAlert.type,
      targetPrice: newPriceAlert.type !== 'change' ? parseFloat(newPriceAlert.targetPrice) : undefined,
      changePercent: newPriceAlert.type === 'change' ? parseFloat(newPriceAlert.changePercent) : undefined,
      isActive: true,
    });

    addNotification({
      type: 'price',
      title: 'Price Alert Created',
      message: `Alert set for ${alert.symbol} ${alert.type === 'above' ? 'above' : alert.type === 'below' ? 'below' : 'change'} ${alert.targetPrice || alert.changePercent}%`,
      symbol: alert.symbol,
    });

    setNewPriceAlert({ symbol: '', type: 'above', targetPrice: '', changePercent: '' });
    setShowPriceAlertModal(false);
    loadAlerts();
  };

  const handleAddPredictionAlert = () => {
    if (!newPredictionAlert.symbol) {
      alert('Please enter a symbol');
      return;
    }

    const alert = predictionAlertsService.add({
      symbol: newPredictionAlert.symbol.toUpperCase(),
      action: newPredictionAlert.action,
      isActive: true,
    });

    addNotification({
      type: 'prediction',
      title: 'Prediction Alert Created',
      message: `Alert set for ${alert.symbol} when prediction changes to ${alert.action}`,
      symbol: alert.symbol,
    });

    setNewPredictionAlert({ symbol: '', action: 'LONG' });
    setShowPredictionAlertModal(false);
    loadAlerts();
  };

  const handleDeletePriceAlert = (id: string) => {
    if (confirm('Are you sure you want to delete this alert?')) {
      priceAlertsService.delete(id);
      loadAlerts();
    }
  };

  const handleDeletePredictionAlert = (id: string) => {
    if (confirm('Are you sure you want to delete this alert?')) {
      predictionAlertsService.delete(id);
      loadAlerts();
    }
  };

  const handleTogglePriceAlert = (id: string) => {
    const alert = priceAlerts.find(a => a.id === id);
    if (alert) {
      priceAlertsService.update(id, { isActive: !alert.isActive });
      loadAlerts();
    }
  };

  const handleTogglePredictionAlert = (id: string) => {
    const alert = predictionAlerts.find(a => a.id === id);
    if (alert) {
      predictionAlertsService.update(id, { isActive: !alert.isActive });
      loadAlerts();
    }
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Alerts & Notifications</h1>
            <p className="text-gray-400 text-sm">Manage your price and prediction alerts</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPriceAlertModal(true)}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Price Alert
            </button>
            <button
              onClick={() => setShowPredictionAlertModal(true)}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Prediction Alert
            </button>
          </div>
        </div>

        {/* Browser Notification Permission */}
        {browserNotificationPermission !== 'granted' && (
          <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-yellow-400 font-semibold mb-1">Enable Browser Notifications</p>
                <p className="text-yellow-300 text-sm mb-3">
                  Allow browser notifications to receive alerts even when the dashboard is not open.
                </p>
                <button
                  onClick={handleRequestPermission}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Enable Notifications
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Price Alerts */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              Price Alerts ({priceAlerts.length})
            </h2>
          </div>
          {priceAlerts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No price alerts set</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {priceAlerts.map((alert) => (
                <div key={alert.id} className="p-4 hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-white font-bold text-lg">{alert.symbol}</span>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          alert.isActive
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {alert.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {alert.triggeredAt && (
                          <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-500/20 text-blue-400">
                            Triggered
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">
                        {alert.type === 'above' && `Alert when price goes above $${alert.targetPrice?.toFixed(2)}`}
                        {alert.type === 'below' && `Alert when price goes below $${alert.targetPrice?.toFixed(2)}`}
                        {alert.type === 'change' && `Alert when price changes by ${alert.changePercent}%`}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        Created {new Date(alert.createdAt).toLocaleString()}
                        {alert.triggeredAt && ` • Triggered ${new Date(alert.triggeredAt).toLocaleString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTogglePriceAlert(alert.id)}
                        className={`px-3 py-1.5 rounded text-sm transition-colors ${
                          alert.isActive
                            ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        }`}
                      >
                        {alert.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleDeletePriceAlert(alert.id)}
                        className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Prediction Alerts */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              Prediction Alerts ({predictionAlerts.length})
            </h2>
          </div>
          {predictionAlerts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No prediction alerts set</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {predictionAlerts.map((alert) => (
                <div key={alert.id} className="p-4 hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-white font-bold text-lg">{alert.symbol}</span>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          alert.action === 'LONG' ? 'bg-green-500/20 text-green-400' :
                          alert.action === 'SHORT' ? 'bg-red-500/20 text-red-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {alert.action}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          alert.isActive
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {alert.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm">
                        Alert when prediction changes to {alert.action}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        Created {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTogglePredictionAlert(alert.id)}
                        className={`px-3 py-1.5 rounded text-sm transition-colors ${
                          alert.isActive
                            ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        }`}
                      >
                        {alert.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleDeletePredictionAlert(alert.id)}
                        className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Price Alert Modal */}
        {showPriceAlertModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Add Price Alert</h3>
                <button
                  onClick={() => setShowPriceAlertModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Symbol</label>
                  <input
                    type="text"
                    value={newPriceAlert.symbol}
                    onChange={(e) => setNewPriceAlert({ ...newPriceAlert, symbol: e.target.value.toUpperCase() })}
                    placeholder="e.g., AAPL"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Alert Type</label>
                  <select
                    value={newPriceAlert.type}
                    onChange={(e) => setNewPriceAlert({ ...newPriceAlert, type: e.target.value as any })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="above">Price goes above</option>
                    <option value="below">Price goes below</option>
                    <option value="change">Price changes by %</option>
                  </select>
                </div>
                {newPriceAlert.type !== 'change' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Target Price</label>
                    <input
                      type="number"
                      value={newPriceAlert.targetPrice}
                      onChange={(e) => setNewPriceAlert({ ...newPriceAlert, targetPrice: e.target.value })}
                      placeholder="0.00"
                      step="0.01"
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Change Percentage</label>
                    <input
                      type="number"
                      value={newPriceAlert.changePercent}
                      onChange={(e) => setNewPriceAlert({ ...newPriceAlert, changePercent: e.target.value })}
                      placeholder="5.0"
                      step="0.1"
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleAddPriceAlert}
                    className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
                  >
                    Create Alert
                  </button>
                  <button
                    onClick={() => setShowPriceAlertModal(false)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Prediction Alert Modal */}
        {showPredictionAlertModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Add Prediction Alert</h3>
                <button
                  onClick={() => setShowPredictionAlertModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Symbol</label>
                  <input
                    type="text"
                    value={newPredictionAlert.symbol}
                    onChange={(e) => setNewPredictionAlert({ ...newPredictionAlert, symbol: e.target.value.toUpperCase() })}
                    placeholder="e.g., AAPL"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Alert When Prediction Changes To</label>
                  <select
                    value={newPredictionAlert.action}
                    onChange={(e) => setNewPredictionAlert({ ...newPredictionAlert, action: e.target.value as any })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="LONG">LONG (Buy)</option>
                    <option value="SHORT">SHORT (Sell)</option>
                    <option value="HOLD">HOLD</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleAddPredictionAlert}
                    className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold transition-colors"
                  >
                    Create Alert
                  </button>
                  <button
                    onClick={() => setShowPredictionAlertModal(false)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
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

export default AlertsPage;

