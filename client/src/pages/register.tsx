import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

const registrationSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  netsuiteCustomerId: z.string().min(1, 'Customer ID is required'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegistrationForm = z.infer<typeof registrationSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get customer ID from URL parameters
  const searchParams = new URLSearchParams(window.location.search);
  const customerId = searchParams.get('customerId') || '';
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      netsuiteCustomerId: customerId,
    },
  });

  const onSubmit = async (data: RegistrationForm) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest('POST', '/api/auth/register', data);
      const responseData = await response.json();
      
      // Store token and redirect to dashboard
      localStorage.setItem('auth_token', responseData.token);
      
      // Force a page reload to ensure auth context picks up the new token
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Create Account</CardTitle>
          <CardDescription className="text-sm">
            Register for your customer portal
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            {error && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="netsuiteCustomerId" className="text-sm">Customer ID</Label>
                <Input
                  id="netsuiteCustomerId"
                  {...register('netsuiteCustomerId')}
                  placeholder="NetSuite ID"
                  disabled={!!customerId}
                  className="h-9 text-sm"
                />
                {errors.netsuiteCustomerId && (
                  <p className="text-xs text-red-500">{errors.netsuiteCustomerId.message}</p>
                )}
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="companyName" className="text-sm">Company (Optional)</Label>
                <Input
                  id="companyName"
                  {...register('companyName')}
                  placeholder="Company Name"
                  autoComplete="organization"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="email" className="text-sm">Email Address</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="you@example.com"
                autoComplete="email"
                className="h-9 text-sm"
              />
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="password" className="text-sm">Password</Label>
                <Input
                  id="password"
                  type="password"
                  {...register('password')}
                  placeholder="8+ characters"
                  autoComplete="new-password"
                  className="h-9 text-sm"
                />
                {errors.password && (
                  <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
                )}
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="confirmPassword" className="text-sm">Confirm</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  {...register('confirmPassword')}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  className="h-9 text-sm"
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="firstName" className="text-sm">First Name</Label>
                <Input
                  id="firstName"
                  {...register('firstName')}
                  placeholder="John (Optional)"
                  autoComplete="given-name"
                  className="h-9 text-sm"
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="lastName" className="text-sm">Last Name</Label>
                <Input
                  id="lastName"
                  {...register('lastName')}
                  placeholder="Doe (Optional)"
                  autoComplete="family-name"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            
            <Button
              type="submit"
              className="w-full h-9 text-sm mt-4"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="pt-3 pb-4">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-primary text-center w-full">
            Already have an account? Sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}