import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";

interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  isNetSuiteUser?: boolean;
  netsuiteCustomerId?: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Check for existing token on app load
    const savedToken = localStorage.getItem('auth_token');
    console.log('AuthProvider: Checking for saved token:', savedToken ? 'Found' : 'Not found');
    if (savedToken) {
      setToken(savedToken);
      // Verify token with server
      verifyToken(savedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/register', '/create-account', '/forgot-password', '/reset-password'];
    const currentPath = window.location.pathname;
    
    // Check if current path is a public route
    const isPublicRoute = publicRoutes.some(route => currentPath.includes(route));
    
    // Redirect to login if not authenticated and not on a public route
    if (!isLoading && !user && !token && !isPublicRoute) {
      console.log('AuthProvider: Redirecting to login - isLoading:', isLoading, 'user:', user, 'token:', token, 'pathname:', currentPath);
      setLocation('/login');
    }
  }, [user, isLoading, token, setLocation]);

  // Add effect to check for token changes and verify them
  useEffect(() => {
    const checkTokenChanges = () => {
      const currentToken = localStorage.getItem('auth_token');
      if (currentToken && currentToken !== token) {
        console.log('AuthProvider: New token detected, verifying...');
        setToken(currentToken);
        verifyToken(currentToken);
      }
    };

    // Check immediately
    checkTokenChanges();

    // Set up storage event listener for changes from other tabs
    window.addEventListener('storage', checkTokenChanges);
    
    return () => {
      window.removeEventListener('storage', checkTokenChanges);
    };
  }, [token]);

  const verifyToken = async (token: string) => {
    try {
      console.log('AuthProvider: Verifying token...');
      const response = await fetch('/api/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('AuthProvider: Token verification response:', response.status);

      if (response.ok) {
        const userData = await response.json();
        console.log('AuthProvider: User data received:', userData);
        setUser(userData);
      } else {
        // Token invalid, clear it
        console.log('AuthProvider: Token invalid, clearing...');
        localStorage.removeItem('auth_token');
        setToken(null);
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('auth_token');
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const { token, user } = await response.json();
    
    localStorage.setItem('auth_token', token);
    setToken(token);
    setUser(user);
    setLocation('/');
  };

  // NetSuite SSO - users authenticate directly with NetSuite
  // No password-based authentication for NetSuite accounts

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    setLocation('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
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
