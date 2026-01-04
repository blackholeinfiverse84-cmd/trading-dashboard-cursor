import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { stockAPI } from '../services/api';

interface ConnectionState {
  isConnected: boolean;
  isChecking: boolean;
  error: string | null;
  lastCheck: Date | null;
  backendUrl: string;
}

interface ConnectionContextType {
  connectionState: ConnectionState;
  checkConnection: () => Promise<void>;
  forceCheck: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: true,
    isChecking: true,
    error: null,
    lastCheck: null,
    backendUrl: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
  });

  const checkConnection = useCallback(async (isForceCheck = false) => {
    setConnectionState(prev => {
      // Don't check if already checking (unless it's a force check)
      if (prev.isChecking && !isForceCheck) {
        return prev;
      }
      // Don't check if we checked within last 10 seconds (unless forced)
      if (!isForceCheck && prev.lastCheck) {
        const timeSinceLastCheck = Date.now() - prev.lastCheck.getTime();
        if (timeSinceLastCheck < 10000) { // 10 seconds cache
          return prev; // Return cached state
        }
      }
      return { ...prev, isChecking: true, error: null };
    });

    try {
      const result = await stockAPI.checkConnection(2);
      
      setConnectionState(prev => ({
        ...prev,
        isConnected: result.connected,
        isChecking: false,
        error: result.connected ? null : (result.error || 'Backend server is not reachable'),
        lastCheck: new Date(),
      }));
    } catch (err: any) {
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        isChecking: false,
        error: err.message || 'Unable to connect to backend server',
        lastCheck: new Date(),
      }));
    }
  }, []);

  const forceCheck = useCallback(async () => {
    await checkConnection(true);
  }, [checkConnection]);

  useEffect(() => {
    // Initial check
    checkConnection();

    // Check every 120 seconds (2 minutes) to reduce API calls and avoid rate limits
    const interval = setInterval(() => {
      checkConnection();
    }, 120000); // Changed to 120 seconds (2 minutes) to reduce rate limit issues

    return () => clearInterval(interval);
  }, [checkConnection]); // Include checkConnection in dependencies

  return (
    <ConnectionContext.Provider value={{ connectionState, checkConnection, forceCheck }}>
      {children}
    </ConnectionContext.Provider>
  );
};

export const useConnection = (): ConnectionContextType => {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within ConnectionProvider');
  }
  return context;
};

