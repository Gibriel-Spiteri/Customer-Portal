import { useState } from 'react';
import { Link } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

const requestPasswordResetSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type RequestPasswordResetForm = z.infer<typeof requestPasswordResetSchema>;

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestPasswordResetForm>({
    resolver: zodResolver(requestPasswordResetSchema),
  });

  const onSubmit = async (data: RequestPasswordResetForm) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    setResetUrl(null);
    
    try {
      const response = await apiRequest('POST', '/api/auth/request-password-reset', data);
      const responseData = await response.json();
      
      setSuccess(true);
      
      // In development, show the reset URL
      if (responseData.resetUrl) {
        setResetUrl(responseData.resetUrl);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <img 
              src="https://1212804.app.netsuite.com/core/media/media.nl?id=9641134&c=1212804&h=mTEBmvmdDKM4h0mgbLpG789NURbPi4V1b2DrTREho5ho_PnP"
              alt="Company Logo"
              className="h-10 w-auto"
            />
          </div>
          <CardTitle className="text-2xl">Forgot Password</CardTitle>
          <CardDescription>
            Enter your email to receive a password reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4">
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  If an account exists with this email, a password reset link has been sent.
                </AlertDescription>
              </Alert>
              
              {resetUrl && (
                <Alert>
                  <AlertDescription>
                    <strong>Development Mode:</strong> Reset URL:
                    <br />
                    <Link href={resetUrl.replace('http://localhost:5000', '')} className="text-blue-600 underline break-all">
                      {resetUrl}
                    </Link>
                  </AlertDescription>
                </Alert>
              )}
              
              <Button asChild className="w-full">
                <Link href="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Login
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>
              
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Reset Link...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </form>
          )}
        </CardContent>
        {!success && (
          <CardFooter className="flex justify-center">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-primary">
              <ArrowLeft className="inline h-3 w-3 mr-1" />
              Back to Login
            </Link>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}