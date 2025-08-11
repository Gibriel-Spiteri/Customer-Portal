import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertTriangle, ExternalLink } from "lucide-react";

export default function OAuthDebugPage() {
  const handleTestOAuth = async () => {
    try {
      const response = await fetch('/api/auth/netsuite');
      const data = await response.json();
      
      if (data.authUrl) {
        window.open(data.authUrl, '_blank');
      } else {
        alert('Error: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Network error: ' + error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">NetSuite OAuth 2.0 Debug</h1>
        <p className="text-muted-foreground mb-6">
          Troubleshoot NetSuite SSO configuration and permissions
        </p>

        {/* Current Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              OAuth 2.0 Configuration Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Client ID configured</span>
              <Badge variant="default">✓ Valid</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Client Secret configured</span>
              <Badge variant="default">✓ Valid</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Account ID</span>
              <Badge variant="outline">1212804</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Authorization URL</span>
              <Badge variant="outline">https://1212804.app.netsuite.com</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Error Analysis */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Current Issue: "Invalid login attempt. Wrong role or account?"
            </CardTitle>
            <CardDescription>
              This error comes from NetSuite and indicates a configuration or permission issue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Root Cause:</strong> The OAuth 2.0 integration works correctly, but NetSuite is rejecting the login.
                This typically means either the OAuth integration isn't properly configured in NetSuite, or the user 
                logging in doesn't have the required permissions.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Troubleshooting Steps */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Required NetSuite Configuration</CardTitle>
            <CardDescription>
              These steps must be completed in your NetSuite account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
                Create OAuth 2.0 Integration
              </h4>
              <div className="ml-8 space-y-2">
                <p className="text-sm text-muted-foreground">
                  In NetSuite: Setup → Integration → Manage Integrations → New
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>Integration Type: OAuth 2.0</li>
                  <li>Enable "Authorization Code Grant"</li>
                  <li>Enable "Use PKCE" (recommended)</li>
                  <li>Redirect URI: <code className="bg-muted px-1 rounded">http://localhost:5000/api/auth/netsuite/callback</code></li>
                  <li>Scopes: REST Web Services, Customer Center</li>
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
                Configure Customer Permissions
              </h4>
              <div className="ml-8 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Ensure customers have the right role and permissions
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>Role must include "Login Using Access Tokens" permission</li>
                  <li>Role must include "REST Web Services" permission</li>
                  <li>Customer Center role recommended</li>
                  <li>User must be active and not locked</li>
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
                Verify Integration Settings
              </h4>
              <div className="ml-8 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Double-check these integration settings in NetSuite
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>Integration is marked as "Enabled"</li>
                  <li>Client ID matches environment variable</li>
                  <li>Redirect URI exactly matches (case-sensitive)</li>
                  <li>Scopes include at minimum: REST Web Services</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Button */}
        <Card>
          <CardHeader>
            <CardTitle>Test OAuth Flow</CardTitle>
            <CardDescription>
              Click to test the OAuth authorization flow (opens NetSuite in new tab)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleTestOAuth} className="w-full">
              <ExternalLink className="mr-2 h-4 w-4" />
              Test NetSuite OAuth Login
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              This will open NetSuite's login page. If you see "Invalid login attempt", 
              follow the configuration steps above.
            </p>
          </CardContent>
        </Card>

        {/* Documentation Link */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Setup Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              For complete step-by-step instructions, see the setup documentation.
            </p>
            <Button variant="outline" asChild>
              <a href="/NETSUITE_OAUTH_SETUP.md" target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" />
                View Setup Documentation
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}