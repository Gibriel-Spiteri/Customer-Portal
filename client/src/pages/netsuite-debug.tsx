import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, Info, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface NetSuiteTestResult {
  success: boolean;
  message: string;
  details?: any;
}

interface NetSuiteDebugInfo {
  configuration: {
    configured: boolean;
    missing: string[];
  };
  debug: {
    accountId: string;
    consumerKey: string;
    consumerSecret: string;
    tokenId: string;
    tokenSecret: string;
    baseUrl: string;
    configured: boolean;
  };
  environment: {
    nodeEnv: string;
    hasAccountId: boolean;
    hasConsumerKey: boolean;
    hasConsumerSecret: boolean;
    hasTokenId: boolean;
    hasTokenSecret: boolean;
  };
}

export default function NetSuiteDebug() {
  const [testResult, setTestResult] = useState<NetSuiteTestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { data: debugInfo, isLoading: debugLoading, refetch: refetchDebug } = useQuery({
    queryKey: ['/api/netsuite/debug'],
    queryFn: async (): Promise<NetSuiteDebugInfo> => {
      const response = await fetch('/api/netsuite/debug');
      if (!response.ok) {
        throw new Error('Failed to fetch debug info');
      }
      return response.json();
    }
  });

  const handleTest = async () => {
    setIsLoading(true);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/netsuite/test');
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (debugLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading debug information...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">NetSuite Debug Console</h1>
        <Button onClick={() => refetchDebug()} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Configuration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {debugInfo?.configuration.configured ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            Configuration Status
          </CardTitle>
          <CardDescription>
            NetSuite API credentials and configuration status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={debugInfo?.configuration.configured ? "default" : "destructive"}>
                {debugInfo?.configuration.configured ? "Configured" : "Not Configured"}
              </Badge>
            </div>
            
            {debugInfo?.configuration.missing && debugInfo.configuration.missing.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-red-600 mb-2">Missing Credentials:</h4>
                <div className="flex flex-wrap gap-2">
                  {debugInfo.configuration.missing.map((item) => (
                    <Badge key={item} variant="destructive" className="text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Account ID:</strong> {debugInfo?.debug.accountId || 'Not set'}
              </div>
              <div>
                <strong>Base URL:</strong> {debugInfo?.debug.baseUrl || 'Not configured'}
              </div>
              <div>
                <strong>Consumer Key:</strong> {debugInfo?.debug.consumerKey || 'Not set'}
              </div>
              <div>
                <strong>Token ID:</strong> {debugInfo?.debug.tokenId || 'Not set'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Environment Check */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            Environment Variables
          </CardTitle>
          <CardDescription>
            Status of environment variables in the runtime
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span>NETSUITE_ACCOUNT_ID:</span>
              <Badge variant={debugInfo?.environment.hasAccountId ? "default" : "destructive"}>
                {debugInfo?.environment.hasAccountId ? "Set" : "Missing"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span>NETSUITE_CONSUMER_KEY:</span>
              <Badge variant={debugInfo?.environment.hasConsumerKey ? "default" : "destructive"}>
                {debugInfo?.environment.hasConsumerKey ? "Set" : "Missing"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span>NETSUITE_CONSUMER_SECRET:</span>
              <Badge variant={debugInfo?.environment.hasConsumerSecret ? "default" : "destructive"}>
                {debugInfo?.environment.hasConsumerSecret ? "Set" : "Missing"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span>NETSUITE_TOKEN_ID:</span>
              <Badge variant={debugInfo?.environment.hasTokenId ? "default" : "destructive"}>
                {debugInfo?.environment.hasTokenId ? "Set" : "Missing"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span>NETSUITE_TOKEN_SECRET:</span>
              <Badge variant={debugInfo?.environment.hasTokenSecret ? "default" : "destructive"}>
                {debugInfo?.environment.hasTokenSecret ? "Set" : "Missing"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span>NODE_ENV:</span>
              <Badge variant="outline">
                {debugInfo?.environment.nodeEnv || 'Not set'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Connection Test
          </CardTitle>
          <CardDescription>
            Test the actual API connection to NetSuite
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button 
              onClick={handleTest} 
              disabled={isLoading || !debugInfo?.configuration.configured}
              className="w-full"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Test NetSuite Connection
            </Button>

            {testResult && (
              <div className={`p-4 rounded-lg border ${
                testResult.success 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {testResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <strong className={testResult.success ? 'text-green-800' : 'text-red-800'}>
                    {testResult.success ? 'Success' : 'Failed'}
                  </strong>
                </div>
                <p className={`text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                  {testResult.message}
                </p>
                
                {testResult.details && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      View Details
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                      {JSON.stringify(testResult.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current Issue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Current Authentication Issue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <p>
              <strong>Status:</strong> NetSuite is rejecting the OAuth token with "Invalid login attempt"
            </p>
            <p>
              <strong>Error Code:</strong> INVALID_LOGIN
            </p>
            <p>
              <strong>Key Diagnostic:</strong> Login Audit Trail shows blank 'role' field - this indicates NetSuite cannot determine token permissions
            </p>
            <p>
              <strong>Most Likely Causes:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Token expired or revoked</strong> (Check Setup → Users/Roles → Access Tokens)</li>
              <li><strong>Associated user is inactive</strong> (Check user status in Manage Users)</li>
              <li><strong>Missing role assignments</strong> (Token user has no active roles)</li>
              <li><strong>Insufficient role permissions</strong> (Role lacks Web Services access)</li>
            </ul>
            <p>
              <strong>Immediate Actions:</strong>
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Check token ID <code>355e63bf...</code> status in Access Tokens</li>
              <li>Verify the associated user account is active</li>
              <li>Confirm user has roles with Web Services permissions</li>
              <li>If token is expired/revoked, regenerate new token credentials</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}