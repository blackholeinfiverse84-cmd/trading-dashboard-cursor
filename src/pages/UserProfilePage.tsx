import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';
import { LogOut, User, Mail, Settings } from 'lucide-react';
import Layout from '../components/Layout';

interface ConfirmModal {
  show: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const UserProfilePage = () => {
  const { user, logout } = useAuth();
  const { showNotification } = useNotification();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModal>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  const isLight = theme === 'light';
  const isSpace = theme === 'space';

  const handleLogoutClick = () => {
    setConfirmModal({
      show: true,
      title: 'Confirm Logout',
      message: 'Are you sure you want to logout? All unsaved data will be lost.',
      onConfirm: handleConfirmLogout,
      onCancel: handleCancelLogout,
    });
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Call logout (this clears local state)
      logout();
      showNotification('success', 'Logged Out', 'You have been successfully logged out.');
      // Redirect to login
      setTimeout(() => {
        navigate('/login');
      }, 500);
    } catch (error: any) {
      showNotification('error', 'Logout Failed', error.message || 'Failed to logout.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleCancelLogout = () => {
    setConfirmModal({ ...confirmModal, show: false });
  };

  return (
    <Layout>
      <div className={`min-h-screen bg-gradient-to-br p-4 md:p-8 ${
        isLight
          ? 'from-slate-50 to-blue-50'
          : isSpace
            ? 'from-slate-900 to-blue-900'
            : 'from-slate-900 to-blue-900'
      }`}>
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className={`text-4xl font-bold mb-2 ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}>
              User Profile
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Manage your account settings and preferences
            </p>
          </div>

          {/* Profile Card */}
          <div className={`rounded-2xl shadow-lg overflow-hidden ${
            isLight ? 'bg-white' : 'bg-slate-800'
          }`}>
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-8 text-white">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">
                    {user?.username || 'Unknown User'}
                  </h2>
                  <p className="text-blue-100">Connected Account</p>
                </div>
              </div>
            </div>

            {/* Profile Info */}
            <div className="p-8 space-y-6">
              {/* Username */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4" />
                    Username
                  </div>
                </label>
                <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-4 text-slate-900 dark:text-slate-100 font-medium">
                  {user?.username || 'N/A'}
                </div>
              </div>

              {/* Auth Token Status */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4" />
                    Authentication Status
                  </div>
                </label>
                <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-slate-900 dark:text-slate-100 font-medium">
                      Authenticated
                    </span>
                  </div>
                </div>
              </div>

              {/* Account Info */}
              <div className="bg-blue-50 dark:bg-slate-700/50 rounded-lg p-4 border border-blue-200 dark:border-slate-600">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">Account Status:</span> Active
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-2">
                  <span className="font-semibold">Login Method:</span> Email & Password
                </p>
              </div>

              {/* Risk Settings Preview */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                  Trading Preferences
                </h3>
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <p>• Risk Assessment: Enabled</p>
                  <p>• Stop-Loss Alerts: Enabled</p>
                  <p>• Trade Confirmations: Required</p>
                </div>
              </div>

              {/* Logout Section */}
              <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={handleLogoutClick}
                  disabled={isLoggingOut}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-semibold rounded-lg transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </button>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 text-center">
                  This will clear your session and log you out from all devices.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation Modal */}
        {confirmModal.show && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`rounded-2xl shadow-2xl max-w-sm w-full p-6 ${
              isLight ? 'bg-white' : 'bg-slate-800'
            }`}>
              <h3 className={`text-xl font-bold mb-3 ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}>
                {confirmModal.title}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {confirmModal.message}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={confirmModal.onCancel}
                  disabled={isLoggingOut}
                  className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  disabled={isLoggingOut}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-semibold rounded-lg transition-colors"
                >
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default UserProfilePage;
