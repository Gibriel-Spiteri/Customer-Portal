import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function NotFound() {
  const { user, token, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    console.log('NotFound component - auth state:', { user: !!user, token: !!token, isLoading });
    // If user is not authenticated, redirect to login instead of showing 404
    if (!isLoading && !user && !token) {
      console.log('NotFound: User not authenticated, redirecting to login');
      setLocation('/login');
    }
  }, [user, token, isLoading, setLocation]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Did you forget to add the page to the router?
          </p>
          
          <div className="mt-4 p-2 bg-gray-100 rounded text-xs">
            <p><strong>Debug:</strong></p>
            <p>User: {user ? 'Authenticated' : 'Not authenticated'}</p>
            <p>Token: {token ? 'Present' : 'Missing'}</p>
            <p>Loading: {isLoading ? 'Yes' : 'No'}</p>
            <p>Path: {window.location.pathname}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
