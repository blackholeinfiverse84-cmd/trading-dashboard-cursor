import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import { config } from '../config';

interface User {
  username: string;
  token: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string, email: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  _isProvider: boolean; // Internal flag to check if we're inside a provider
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initialize user from localStorage synchronously to prevent redirect on page reload
const initializeUser = (): User | null => {
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  // Only return user if token is a valid JWT (not 'no-auth-required')
  if (token && token !== 'no-auth-required' && username) {
    return { username, token };
  }
  // Clear invalid tokens
  if (token === 'no-auth-required') {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  }
  return null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Check if backend auth is disabled (open access mode)
  // In open access mode, we allow anonymous users
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null); // null = not checked yet
  const [user, setUser] = useState<User | null>(initializeUser);

  const checkAuthStatus = useCallback(async () => {
    try {
      // Use fetch with better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      try {
        const response = await fetch(`${config.API_BASE_URL}/`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          // Backend specifies auth_status: 'disabled' when auth is off
          if (data.auth_status === 'disabled') {
            setAuthEnabled(false);
            // Auto-login as anonymous user when auth is disabled
            const anonymousUser = { username: 'anonymous', token: 'no-auth-required' };
            setUser(anonymousUser);
            localStorage.setItem('token', 'no-auth-required');
            localStorage.setItem('username', 'anonymous');
          } else {
            // Auth is enabled
            setAuthEnabled(true);
            const currentToken = localStorage.getItem('token');
            const currentUsername = localStorage.getItem('username');
            
            if (currentToken === 'no-auth-required') {
              // Clear invalid token (auth is enabled but we have no-auth token)
              localStorage.removeItem('token');
              localStorage.removeItem('username');
              setUser(null);
            } else if (currentToken && currentUsername && currentToken !== 'no-auth-required') {
              // We have a valid token - restore user
              setUser({ username: currentUsername, token: currentToken });
            }
          }
        } else {
          // Non-200 response - assume auth is required
          setAuthEnabled(true);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // If it's an abort (timeout), try to use cached auth status
        if (fetchError.name === 'AbortError') {
          // Check if we have a cached auth status
          const cachedToken = localStorage.getItem('token');
          if (cachedToken === 'no-auth-required') {
            // We've been in no-auth mode before, assume it's still disabled
            setAuthEnabled(false);
            const anonymousUser = { username: 'anonymous', token: 'no-auth-required' };
            setUser(anonymousUser);
            return;
          }
        }
        
        // For other errors, assume auth is required but don't log as warning
        // This is normal if backend is starting up
        setAuthEnabled(true);
      }
    } catch (error) {
      // Fallback: check localStorage for previous auth status
      const cachedToken = localStorage.getItem('token');
      if (cachedToken === 'no-auth-required') {
        // We've been in no-auth mode before, assume it's still disabled
        setAuthEnabled(false);
        const anonymousUser = { username: 'anonymous', token: 'no-auth-required' };
        setUser(anonymousUser);
      } else {
        // Assume auth is required
        setAuthEnabled(true);
      }
    }
  }, []);

  useEffect(() => {
    // Check backend auth status on mount
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Auto-login attempt when auth is enabled and no token exists
  useEffect(() => {
    // Don't try auto-login if auth is disabled or not yet determined
    if (authEnabled !== true) {
      return;
    }
    
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    
    // Only try auto-login if no token exists and not on login page
    if (!token && !username && typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      const tryAutoLogin = async () => {
        try {
          const response = await authAPI.login('admin', 'admin123');
          if (response.success && response.token) {
            const userData = { 
              username: response.username || 'admin', 
              token: response.token 
            };
            setUser(userData);
            localStorage.setItem('token', response.token);
            localStorage.setItem('username', response.username || 'admin');
          }
        } catch (err) {
          // Auto-login failed silently - user will need to login manually
          // Don't log this as it's expected behavior
        }
      };
      tryAutoLogin();
    }
  }, [authEnabled]);

  const login = useCallback(async (username: string, password: string) => {
    // If auth is disabled, allow any login or skip login
    if (authEnabled === false) {
      const userData = { 
        username: username || 'anonymous', 
        token: 'no-auth-required' 
      };
      setUser(userData);
      localStorage.setItem('token', 'no-auth-required');
      localStorage.setItem('username', userData.username);
      return;
    }
    
    // Only try to login via API if auth is enabled
    if (authEnabled === true) {
      try {
        const response = await authAPI.login(username, password);
        
        if (response.success && response.token) {
          const userData = { 
            username: response.username || username, 
            token: response.token 
          };
          setUser(userData);
          localStorage.setItem('token', response.token);
          localStorage.setItem('username', response.username || username);
        } else {
          throw new Error(response.error || 'Login failed');
        }
      } catch (error: any) {
        // Handle axios errors
        if (error.response?.data?.detail) {
          throw new Error(error.response.data.detail);
        }
        throw new Error(error.message || 'Login failed. Please check your credentials.');
      }
    }
  }, [authEnabled]);

  const signup = async (username: string, password: string, email: string) => {
    // If auth is disabled, just log in as the username
    if (!authEnabled) {
      await login(username, password);
      return;
    }
    
    // Backend doesn't have signup endpoint, so we'll use the authAPI signup which simulates it
    // In production, you'd add a signup endpoint to the backend
    try {
      const response = await authAPI.signup(username, password, email);
      if (!response.success) {
        throw new Error(response.message || 'Signup failed');
      }
      // After successful signup, automatically log in
      await login(username, password);
    } catch (error: any) {
      throw new Error(error.message || 'Signup failed');
    }
  };

  const logout = () => {
    // Clear user state and localStorage regardless of auth status
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    // Note: Navigation is handled by the component calling logout
    // This allows React Router to handle navigation properly
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isAuthenticated: !!user, _isProvider: true }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): Omit<AuthContextType, '_isProvider'> => {
  const context = useContext(AuthContext);
  if (!context || !context._isProvider) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  // Remove internal flag before returning
  const { _isProvider, ...publicContext } = context;
  return publicContext;
};

