import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Check, X, UserPlus, Building2, Mail, Phone, User, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const navigate = useNavigate;
  const { toast } = useToast();

  const [isValidating, setIsValidating] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [invitationValid, setInvitationValid] = useState(false);
  const [invitationData, setInvitationData] = useState<any>(null);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    companyName: "",
    phone: "",
  });

  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecial: false,
    passwordsMatch: false,
  });

  // Get token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  useEffect(() => {
    if (token) {
      validateInvitation();
    } else {
      setError("No invitation token provided. Please use the link from your invitation email.");
    }
  }, [token]);

  useEffect(() => {
    // Validate password requirements
    setPasswordValidation({
      minLength: formData.password.length >= 8,
      hasUppercase: /[A-Z]/.test(formData.password),
      hasLowercase: /[a-z]/.test(formData.password),
      hasNumber: /[0-9]/.test(formData.password),
      hasSpecial: /[^A-Za-z0-9]/.test(formData.password),
      passwordsMatch: formData.password !== "" && formData.password === formData.confirmPassword,
    });
  }, [formData.password, formData.confirmPassword]);

  const validateInvitation = async () => {
    setIsValidating(true);
    setError("");

    try {
      const response = await fetch("/api/auth/validate-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data.valid) {
        setInvitationValid(true);
        setInvitationData(data.data);
        // Pre-fill form with invitation data
        setFormData(prev => ({
          ...prev,
          email: data.data.email || "",
          firstName: data.data.firstName || "",
          lastName: data.data.lastName || "",
          companyName: data.data.companyName || "",
        }));
      } else {
        setError(data.message || "Invalid invitation");
      }
    } catch (err) {
      setError("Failed to validate invitation. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all password requirements
    const allValid = Object.values(passwordValidation).every(v => v);
    if (!allValid) {
      toast({
        title: "Invalid Password",
        description: "Please ensure your password meets all requirements",
        variant: "destructive",
      });
      return;
    }

    setIsRegistering(true);
    setError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          token,
          netsuiteCustomerId: invitationData?.netsuiteCustomerId,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store tokens
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        
        toast({
          title: "Registration Successful!",
          description: "Welcome to the customer portal",
        });

        // Redirect to dashboard
        setTimeout(() => {
          setLocation("/dashboard");
        }, 1000);
      } else {
        setError(data.message || "Registration failed");
      }
    } catch (err) {
      setError("An error occurred during registration. Please try again.");
    } finally {
      setIsRegistering(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-[400px]">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-muted-foreground">Validating invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token || (!invitationValid && !isValidating)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle className="text-red-600">Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error || "Invalid or expired invitation token"}</AlertDescription>
            </Alert>
            <Button
              onClick={() => setLocation("/login")}
              className="w-full mt-4"
              variant="outline"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <UserPlus className="h-10 w-10 text-blue-600" />
          </div>
          <CardTitle className="text-2xl text-center">Create Your Account</CardTitle>
          <CardDescription className="text-center">
            Complete your registration for {invitationData?.companyName || "Customer Portal"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  <User className="w-4 h-4 inline mr-1" />
                  First Name
                </Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">
                  <User className="w-4 h-4 inline mr-1" />
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyName">
                <Building2 className="w-4 h-4 inline mr-1" />
                Company Name
              </Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone (optional)
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                <Lock className="w-4 h-4 inline mr-1" />
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                <Lock className="w-4 h-4 inline mr-1" />
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
              />
            </div>

            {/* Password requirements */}
            <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-sm">
              <p className="font-medium mb-2">Password Requirements:</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-1">
                  {passwordValidation.minLength ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={passwordValidation.minLength ? "text-green-600" : "text-gray-600"}>
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  {passwordValidation.hasUppercase ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={passwordValidation.hasUppercase ? "text-green-600" : "text-gray-600"}>
                    One uppercase letter
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  {passwordValidation.hasLowercase ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={passwordValidation.hasLowercase ? "text-green-600" : "text-gray-600"}>
                    One lowercase letter
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  {passwordValidation.hasNumber ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={passwordValidation.hasNumber ? "text-green-600" : "text-gray-600"}>
                    One number
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  {passwordValidation.hasSpecial ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={passwordValidation.hasSpecial ? "text-green-600" : "text-gray-600"}>
                    One special character
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  {passwordValidation.passwordsMatch ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={passwordValidation.passwordsMatch ? "text-green-600" : "text-gray-600"}>
                    Passwords match
                  </span>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isRegistering}>
              {isRegistering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}