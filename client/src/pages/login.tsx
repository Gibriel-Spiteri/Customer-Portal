import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  Plus,
  Wallet,
  Wrench,
  Target,
  ArrowLeft,
} from "lucide-react";

export default function Login() {
  const [view, setView] = useState<"welcome" | "signin">("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (user && !isLoading) {
      setLocation("/dashboard");
    }
  }, [user, isLoading, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const err = await response.json();
        if (
          err.statusCode === "GLOBAL_HOLD" ||
          err.statusCode === "DISCONTINUED" ||
          err.statusCode === "CONTACT_HOLD"
        ) {
          throw new Error(err.message);
        }
        throw new Error(err.message || "Authentication failed");
      }

      const data = await response.json();
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setIsSubmitting(false);
    }
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

  const features = [
    { icon: Wallet, label: "Profit" },
    { icon: Wrench, label: "Resources" },
    { icon: Target, label: "Opportunity" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Bar */}
      <header className="w-full bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-lg font-bold tracking-tight text-slate-900">
            Consumers <span className="text-[hsl(214,80%,40%)] dark:text-[hsl(210,100%,45%)]">PRO</span>
          </div>
          <button
            onClick={() => setView("signin")}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Portal Login
          </button>
        </div>
      </header>
      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {view === "welcome" ? (
            <div className="text-center">
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
                Welcome to
                <br />
                <span className="text-[hsl(214,80%,40%)] dark:text-[hsl(210,100%,45%)]">Consumers</span>
                <span className="text-slate-900"> PRO</span>
              </h1>
              <p className="mt-6 text-base text-slate-500 leading-relaxed max-w-sm mx-auto">
                Your trusted partner for wholesale purchasing. Access exclusive
                pricing, manage your account, and grow your business with us.
              </p>

              <div className="mt-10 space-y-3">
                <Button
                  onClick={() => setView("signin")}
                  className="w-full h-12 bg-[hsl(214,80%,40%)] hover:bg-[hsl(214,80%,34%)] dark:bg-[hsl(210,100%,45%)] dark:hover:bg-[hsl(210,100%,39%)] text-white text-base font-semibold rounded-lg shadow-sm"
                >
                  <LogIn className="mr-2 h-5 w-5" />
                  Log In to Your Portal
                </Button>
                <Link href="/create-account">
                  <Button
                    variant="outline"
                    className="w-full h-12 border-slate-200 bg-white hover:bg-slate-50 text-slate-900 text-base font-semibold rounded-lg shadow-sm"
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    Sign Up for Wholesale PROgram
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <button
                onClick={() => {
                  setView("welcome");
                  setError("");
                }}
                className="flex items-center text-sm text-slate-500 hover:text-slate-700 mb-6"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </button>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
                <h2 className="text-2xl font-bold text-slate-900">Sign In</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Access your orders, invoices, and account.
                </p>

                {error && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                  <div>
                    <Label
                      htmlFor="email"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Email Address or PRO ID #
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="text"
                      autoComplete="username"
                      required
                      value={email}
                      onChange={(e) => {
                        setError("");
                        setEmail(e.target.value);
                      }}
                      className="mt-1 h-11"
                      placeholder="email@company.com or PRO number"
                      disabled={isSubmitting}
                    />
                    <p className="text-xs text-slate-500 mt-1">Sign in with your email address or PRO ID number #</p>
                  </div>

                  <div>
                    <Label
                      htmlFor="password"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Password
                    </Label>
                    <div className="relative mt-1">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => {
                          setError("");
                          setPassword(e.target.value);
                        }}
                        className="pr-10 h-11"
                        placeholder="Enter your password"
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-slate-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-[hsl(214,80%,40%)] hover:bg-[hsl(214,80%,34%)] dark:bg-[hsl(210,100%,45%)] dark:hover:bg-[hsl(210,100%,39%)] text-white text-base font-semibold rounded-lg"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>

                <div className="flex justify-between items-center mt-4">
                  <Link
                    href="/forgot-password"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Forgot Password?
                  </Link>
                  <Link
                    href="/create-account"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Create Account
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feature cards */}
        <div className="w-full max-w-md mt-16">
          <div className="grid grid-cols-3 gap-3">
            {features.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center bg-white border border-slate-200 rounded-xl p-4 shadow-sm"
              >
                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center mb-2">
                  <Icon className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-xs font-medium text-slate-600">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
      {/* Footer */}
      <footer className="w-full py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Consumers PRO. All rights reserved.
      </footer>
    </div>
  );
}
