import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import MarketScanPage from './pages/MarketScanPage';
import PortfolioPage from './pages/PortfolioPage';
import TradingHistoryPage from './pages/TradingHistoryPage';
import WatchListPage from './pages/WatchListPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AlertsPage from './pages/AlertsPage';
import SettingsPage from './pages/SettingsPage';
import ComparePage from './pages/ComparePage';

interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const { isAuthenticated, user } = useAuth();
  // Allow access if authenticated OR if user is anonymous (auth disabled)
  const hasAccess = isAuthenticated || (user && user.username === 'anonymous');
  return hasAccess ? <>{children}</> : <Navigate to="/login" replace />;
};

interface PublicRouteProps {
  children: React.ReactNode;
}

const PublicRoute = ({ children }: PublicRouteProps) => {
  const { isAuthenticated, user } = useAuth();
  // Redirect to dashboard only if authenticated (not anonymous)
  const shouldRedirect = isAuthenticated && user && user.username !== 'anonymous';
  return !shouldRedirect ? <>{children}</> : <Navigate to="/dashboard" replace />;
};

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/market-scan" element={<MarketScanPage />} />
      <Route path="/portfolio" element={<PortfolioPage />} />
      <Route path="/trading-history" element={<TradingHistoryPage />} />
      <Route path="/watchlist" element={<WatchListPage />} />
      <Route path="/analytics" element={<AnalyticsPage />} />
      <Route path="/alerts" element={<AlertsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/compare" element={<ComparePage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      {/* Catch-all route for 404 */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

