import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  netsuiteCustomerId: string;
  emailVerified?: boolean;
  lastLogin?: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  refreshAccessToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Check for existing tokens on app load
    const savedAccessToken = localStorage.getItem('accessToken');
    const savedRefreshToken = localStorage.getItem('refreshToken');
    const savedUser = localStorage.getItem('user');
    
    console.log('AuthProvider: Checking for saved tokens:', savedAccessToken ? 'Found' : 'Not found');
    
    if (savedAccessToken && savedRefreshToken && savedUser) {
      setAccessToken(savedAccessToken);
      setRefreshToken(savedRefreshToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Failed to parse saved user data');
      }
      // Verify token with server
      verifyToken(savedAccessToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Redirect to login if not authenticated
    const publicPaths = ['/test', '/login', '/register', '/old-login', '/auth', '/netsuite-test', '/netsuite-debug', '/oauth-debug'];
    const isPublicPath = publicPaths.some(path => window.location.pathname.includes(path));
    
    if (!isLoading && !user && !accessToken && !isPublicPath) {
      console.log('AuthProvider: Redirecting to login - path:', window.location.pathname);
      // Only redirect if we're on the root path or protected routes
      if (window.location.pathname === '/' || window.location.pathname.startsWith('/dashboard')) {
        setLocation('/login');
      }
    }
  }, [user, isLoading, accessToken, setLocation]);

  const verifyToken = async (token: string) => {
    try {
      console.log('AuthProvider: Verifying token...');
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('AuthProvider: Token verification response:', response.status);

      if (response.ok) {
        const userData = await response.json();
        console.log('AuthProvider: User data received:', userData);
        setUser(userData);
      } else if (response.status === 403) {
        // Token expired, try to refresh
        console.log('AuthProvider: Token expired, attempting refresh...');
        await refreshAccessToken();
      } else {
        // Token invalid, clear everything
        console.log('AuthProvider: Token invalid, clearing...');
        clearAuth();
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      clearAuth();
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAccessToken = async () => {
    const savedRefreshToken = localStorage.getItem('refreshToken');
    if (!savedRefreshToken) {
      clearAuth();
      return;
    }

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: savedRefreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        setAccessToken(data.accessToken);
        setUser(data.user);
      } else {
        clearAuth();
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      clearAuth();
    }
  };

  const clearAuth = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();
    
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setUser(data.user);
    
    setLocation('/dashboard');
  };

  const logout = async () => {
    try {
      const savedRefreshToken = localStorage.getItem('refreshToken');
      if (savedRefreshToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken: savedRefreshToken }),
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuth();
      setLocation('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      accessToken, 
      refreshToken, 
      login, 
      logout, 
      isLoading,
      refreshAccessToken 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
