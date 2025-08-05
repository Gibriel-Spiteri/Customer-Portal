import { useState } from "react";
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
  const [activeTab, setActiveTab] = useState<'demo' | 'netsuite'>('demo');

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

  const handleNetSuiteLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setNetsuiteSubmitting(true);
    setError("");
    
    try {
      console.log('Attempting NetSuite authentication with:', { 
        email: netsuiteFormData.email,
        hasPassword: !!netsuiteFormData.password 
      });

      const response = await fetch('/api/auth/netsuite-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(netsuiteFormData),
      });

      console.log('NetSuite auth response status:', response.status);
      
      const data = await response.json();
      console.log('NetSuite auth response data:', data);

      if (response.ok) {
        // Store token and redirect to dashboard
        localStorage.setItem('token', data.token);
        console.log('NetSuite authentication successful, redirecting...');
        
        // Use a slight delay to ensure token is stored
        setTimeout(() => {
          window.location.href = '/';
        }, 100);
      } else {
        const errorMessage = data.message || 'NetSuite authentication failed';
        console.error('NetSuite authentication failed:', errorMessage);
        setError(errorMessage);
      }
    } catch (err) {
      console.error('NetSuite authentication error:', err);
      setError('Failed to authenticate with NetSuite. Please try again.');
    } finally {
      setNetsuiteSubmitting(false);
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
                onClick={() => setActiveTab('demo')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'demo'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Demo Login
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('netsuite')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'netsuite'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                NetSuite
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
              <form onSubmit={handleNetSuiteLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="netsuite-email">NetSuite Email</Label>
                  <Input
                    id="netsuite-email"
                    name="email"
                    type="email"
                    value={netsuiteFormData.email}
                    onChange={handleNetsuiteChange}
                    required
                    placeholder="Enter your NetSuite email"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="netsuite-password">NetSuite Password</Label>
                  <div className="relative">
                    <Input
                      id="netsuite-password"
                      name="password"
                      type={showNetsuitePassword ? "text" : "password"}
                      value={netsuiteFormData.password}
                      onChange={handleNetsuiteChange}
                      required
                      placeholder="Enter your NetSuite password"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost" 
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowNetsuitePassword(!showNetsuitePassword)}
                    >
                      {showNetsuitePassword ? (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <Button
                  type="submit"
                  className="w-full bg-green-700 hover:bg-green-600 text-white font-medium"
                  disabled={netsuiteSubmitting}
                  style={{ color: 'white' }}
                >
                  {netsuiteSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Authenticating with NetSuite...
                    </>
                  ) : (
                    'Sign in with NetSuite'
                  )}
                </Button>
                <p className="text-xs text-center text-gray-500">
                  Enter your NetSuite customer portal credentials
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Login Instructions */}
        <div className="space-y-4">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <h3 className="font-medium text-green-800 mb-2">Demo Login</h3>
              <div className="text-sm text-green-700 space-y-1">
                <p><strong>Username:</strong> demo@customer.com</p>
                <p><strong>Password:</strong> demo123</p>
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
