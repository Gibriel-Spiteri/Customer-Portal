import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertCircle, Eye, EyeOff, ExternalLink } from "lucide-react";

export default function Login() {
  const { login, isLoading } = useAuth();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [netsuiteFormData, setNetsuiteFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [netsuiteSubmitting, setNetsuiteSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNetsuitePassword, setShowNetsuitePassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'demo' | 'netsuite'>('netsuite');
  const [oauthLoading, setOauthLoading] = useState(false);
  
  // Check for error parameters in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    if (errorParam) {
      const decodedError = decodeURIComponent(errorParam);
      console.log('Login page: Received error from SSO:', decodedError);
      setError(decodedError);
      // Clear the error from URL
      window.history.replaceState({}, '', '/login');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(formData.username, formData.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleNetSuiteOAuth = async () => {
    setOauthLoading(true);
    setError("");
    
    try {
      // Get OAuth authorization URL from backend
      const response = await fetch('/api/auth/netsuite');
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to initiate OAuth');
      }
      
      const { authUrl } = await response.json();
      
      // Redirect to NetSuite for authentication
      window.location.href = authUrl;
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate NetSuite SSO");
      setOauthLoading(false);
    }
  };

  const handleNetsuiteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(""); // Clear any existing errors when user types
    setNetsuiteFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold netsuite-blue">
            Customer Portal
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your account to access your orders, invoices, and more
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('netsuite')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'netsuite'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                NetSuite Login
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('demo')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'demo'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Demo Mode
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {activeTab === 'demo' && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    placeholder="Enter your username"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={handleChange}
                      required
                      placeholder="Enter your password"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost" 
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <Button
                  type="submit"
                  className="w-full bg-blue-800 hover:bg-blue-700 text-white font-medium"
                  disabled={isSubmitting}
                  style={{ color: 'white' }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            )}

            {activeTab === 'netsuite' && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Sign in using your NetSuite account credentials through secure Suitelet SSO
                  </p>
                </div>
                
                <Button
                  onClick={handleNetSuiteOAuth}
                  className="w-full bg-green-700 hover:bg-green-600 text-white font-medium"
                  disabled={oauthLoading}
                  style={{ color: 'white' }}
                >
                  {oauthLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redirecting to NetSuite...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Sign in with NetSuite SSO
                    </>
                  )}
                </Button>
                
                <div className="text-xs text-center text-gray-500 space-y-1">
                  <p>You will be redirected to NetSuite to authenticate</p>
                  <p>After login, you'll be returned to this portal</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Login Instructions */}
        <div className="space-y-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <h3 className="font-medium text-blue-800 mb-2">Getting Started</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p>Use NetSuite SSO for secure access to your account data</p>
                <p>Demo mode is available for testing (requires account setup)</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <h3 className="font-medium text-blue-800 mb-2">NetSuite Login</h3>
              <div className="text-sm text-blue-700 space-y-2">
                <p>Test with these sample credentials:</p>
                <p><strong>Email:</strong> customer@example.com</p>
                <p><strong>Password:</strong> netsuite123</p>
                <p className="text-xs italic">Or use your actual NetSuite customer credentials</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
