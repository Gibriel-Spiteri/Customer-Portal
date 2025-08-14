import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogIn, Mail, Lock, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CustomLoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store tokens
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        localStorage.setItem("user", JSON.stringify(data.user));
        
        toast({
          title: "Login Successful!",
          description: `Welcome back, ${data.user.firstName}!`,
        });

        // Redirect to dashboard
        setTimeout(() => {
          setLocation("/dashboard");
        }, 500);
      } else {
        setError(data.message || "Invalid email or password");
      }
    } catch (err) {
      setError("An error occurred during login. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Demo login function
  const handleDemoLogin = async (customerId: string) => {
    setIsLoading(true);
    setError("");

    // For demo, we'll create a test invitation and register
    try {
      // First create an invitation
      const inviteResponse = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          netsuiteCustomerId: customerId,
          email: customerId === "441667" ? "baloga@demo.com" : "crd@demo.com",
          companyName: customerId === "441667" ? "Baloga" : "CRD",
          firstName: "Demo",
          lastName: "User",
        }),
      });

      if (!inviteResponse.ok) {
        throw new Error("Failed to create demo invitation");
      }

      const inviteData = await inviteResponse.json();

      // Navigate to registration with the token
      setLocation(`/register?token=${inviteData.token}`);
    } catch (err) {
      toast({
        title: "Demo Setup",
        description: "Please use the invitation link to create your demo account first.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Login Card */}
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <LogIn className="h-10 w-10 text-blue-600" />
            </div>
            <CardTitle className="text-2xl text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center">
              Sign in to your customer portal account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  <Lock className="w-4 h-4 inline mr-1" />
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                <p>Don't have an account?</p>
                <p className="mt-1">Contact your administrator for an invitation link.</p>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Demo Access Card */}
        <Card className="border-2 border-dashed">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <UserPlus className="h-10 w-10 text-purple-600" />
            </div>
            <CardTitle className="text-2xl text-center">Demo Access</CardTitle>
            <CardDescription className="text-center">
              Try the portal with sample customer data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                Select a demo customer to explore the portal features with sample NetSuite data.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Button
                onClick={() => handleDemoLogin("441667")}
                className="w-full bg-purple-600 hover:bg-purple-700"
                disabled={isLoading}
              >
                <Building2 className="mr-2 h-4 w-4" />
                Login as Baloga (441667)
              </Button>

              <Button
                onClick={() => handleDemoLogin("154783")}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                disabled={isLoading}
              >
                <Building2 className="mr-2 h-4 w-4" />
                Login as CRD (154783)
              </Button>
            </div>

            <div className="text-xs text-center text-muted-foreground mt-4">
              <p>Demo accounts include:</p>
              <ul className="mt-2 space-y-1">
                <li>• Order history and invoices</li>
                <li>• CRD rebate records</li>
                <li>• Payment information</li>
                <li>• Account details</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Also need to import Building2
import { Building2 } from "lucide-react";