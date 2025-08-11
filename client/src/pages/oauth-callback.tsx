import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';

export default function OAuthCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Extract token from URL params
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (token) {
      // Store the token
      localStorage.setItem('auth_token', token);
      
      // Trigger a storage event to notify auth context
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'auth_token',
        newValue: token,
        url: window.location.href
      }));
      
      // Redirect to dashboard
      setTimeout(() => {
        setLocation('/');
      }, 1000);
    } else if (error) {
      // Handle error
      console.error('OAuth error:', error);
      setLocation(`/login?error=${encodeURIComponent(error)}`);
    } else {
      // No token or error, redirect to login
      setLocation('/login');
    }
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-4" />
        <p className="text-gray-600">Completing NetSuite authentication...</p>
        <p className="text-sm text-gray-500 mt-2">Please wait while we set up your session</p>
      </div>
    </div>
  );
}