import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ExternalLink, AlertCircle } from 'lucide-react';

interface OAuthAuthorizeProps {
  onSuccess?: () => void;
}

export function OAuthAuthorize({ onSuccess }: OAuthAuthorizeProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuthorize = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get authorization URL from our backend
      const response = await fetch('/api/auth/netsuite', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to initiate authorization');
      }

      const { authUrl } = await response.json();
      
      // Open authorization URL in a new window
      const authWindow = window.open(authUrl, 'netsuiteAuth', 'width=600,height=700');
      
      // Check if the window was closed
      const checkInterval = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkInterval);
          setLoading(false);
          // Check if authorization was successful
          if (onSuccess) {
            onSuccess();
          }
        }
      }, 1000);

    } catch (error) {
      console.error('Authorization error:', error);
      setError(error instanceof Error ? error.message : 'Authorization failed');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>NetSuite Authorization Required</AlertTitle>
        <AlertDescription>
          To access real-time estimates data from NetSuite, you need to authorize this application.
          Click the button below to connect your NetSuite account.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button 
        onClick={handleAuthorize} 
        disabled={loading}
        className="w-full"
      >
        {loading ? (
          'Authorizing...'
        ) : (
          <>
            <ExternalLink className="mr-2 h-4 w-4" />
            Connect to NetSuite
          </>
        )}
      </Button>
    </div>
  );
}