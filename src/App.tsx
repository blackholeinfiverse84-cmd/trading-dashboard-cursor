import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ConnectionProvider } from './contexts/ConnectionContext';
import { NotificationProvider } from './contexts/NotificationContext';
// WebSocketProvider disabled: Backend does not support WebSocket/Socket.IO
// All real-time updates use REST API polling instead
import { AppRoutes } from './routes';
import ErrorBoundary from './components/ErrorBoundary';
import BackendConnectionBanner from './components/BackendConnectionBanner';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <ConnectionProvider>
            <AuthProvider>
              {/* WebSocketProvider removed - backend uses REST API only */}
              <NotificationProvider>
                <BackendConnectionBanner />
                <AppRoutes />
              </NotificationProvider>
            </AuthProvider>
          </ConnectionProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;

