import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export function NetSuiteTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testConnection = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/netsuite/test');
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        message: 'Failed to connect to server',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>NetSuite API Connection Test</CardTitle>
          <CardDescription>
            Test the connection to NetSuite REST API using OAuth 1.0a authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={testConnection} 
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Testing Connection...' : 'Test NetSuite Connection'}
          </Button>

          {result && (
            <Alert className={result.success ? 'border-green-500' : 'border-red-500'}>
              <div className="flex items-start gap-2">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                ) : result.missing ? (
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <AlertTitle className="mb-2">
                    {result.success ? 'Connection Successful!' : 'Connection Failed'}
                  </AlertTitle>
                  <AlertDescription>
                    <p className="mb-2">{result.message}</p>
                    
                    {result.missing && result.missing.length > 0 && (
                      <div className="mt-3">
                        <p className="font-semibold mb-1">Missing configuration:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {result.missing.map((key: string) => (
                            <li key={key} className="text-sm">{key}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {result.details && (
                      <div className="mt-3">
                        <p className="font-semibold mb-1">Details:</p>
                        <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          {/* Configuration Help */}
          <Card className="bg-gray-50 dark:bg-gray-900">
            <CardHeader>
              <CardTitle className="text-lg">NetSuite Configuration Requirements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-semibold mb-1">Required Environment Variables:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                  <li>NETSUITE_ACCOUNT_ID - Your NetSuite account ID</li>
                  <li>NETSUITE_CONSUMER_KEY - From integration record</li>
                  <li>NETSUITE_CONSUMER_SECRET - From integration record</li>
                  <li>NETSUITE_TOKEN_ID - From access token</li>
                  <li>NETSUITE_TOKEN_SECRET - From access token</li>
                </ul>
              </div>
              
              <div>
                <p className="font-semibold mb-1">NetSuite Setup Requirements:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                  <li>Token-Based Authentication must be enabled</li>
                  <li>REST Web Services feature must be enabled</li>
                  <li>Integration record must have ONLY Token-Based Auth checked</li>
                  <li>All OAuth 2.0 options must be unchecked</li>
                  <li>Access token must be active/enabled</li>
                </ul>
              </div>

              {!result?.success && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Troubleshooting Steps</AlertTitle>
                  <AlertDescription className="mt-2">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Check Login Audit Trail in NetSuite for error details</li>
                      <li>Verify all environment variables are set correctly</li>
                      <li>Ensure the integration is enabled in NetSuite</li>
                      <li>Try regenerating the access token if authentication fails</li>
                      <li>Contact NetSuite support if "token_rejected" errors persist</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}