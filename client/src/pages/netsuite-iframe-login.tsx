import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';

export default function NetSuiteIframeLogin() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Handle messages from the iframe (if NetSuite sends any)
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from NetSuite domain
      if (event.origin !== 'https://1212804.app.netsuite.com') {
        return;
      }
      
      console.log('Received message from NetSuite:', event.data);
      
      // Handle different message types from NetSuite
      if (event.data.type === 'login-success') {
        // Redirect to dashboard or handle successful login
        window.location.href = '/dashboard';
      } else if (event.data.type === 'login-error') {
        setError(event.data.message || 'Login failed');
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleIframeLoad = () => {
    setLoading(false);
  };

  const handleIframeError = () => {
    setLoading(false);
    setError('Failed to load NetSuite login form. Please check your connection.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">NetSuite Customer Center Login</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Sign in with your NetSuite Customer Center credentials
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="relative" style={{ minHeight: '600px' }}>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                  <p className="mt-2 text-sm text-gray-600">Loading NetSuite login...</p>
                </div>
              </div>
            )}
            
            <iframe
              src="https://1212804.app.netsuite.com/core/media/media.nl?id=34239&c=1212804&h=bU0AhS-bagTi1W524HZ2uwUveDA5rz2RmnEUe-4SfDW4hTOh&_xt=.html"
              className="w-full border-0"
              style={{ 
                height: '600px',
                backgroundColor: 'white'
              }}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              title="NetSuite Login"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          </div>
          
          <div className="mt-4 text-center text-xs text-gray-500">
            <p>This is a secure NetSuite login form.</p>
            <p>Your credentials are sent directly to NetSuite.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}