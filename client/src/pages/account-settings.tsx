import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { DataBadge } from "@/components/data-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  User, 
  Mail, 
  Building2, 
  CreditCard,
  Shield,
  Save,
  Loader2
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface Account {
  id: string;
  balance: string;
  creditLimit: string | null;
  currency: string;
  isActive: boolean;
  dataFreshness: 'live' | 'cached';
  lastSyncAt: string;
}

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email format"),
  companyName: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function AccountSettings() {
  const { user, token } = useAuth();
  const { toast } = useToast();

  const { data: account, isLoading: accountLoading } = useQuery<Account>({
    queryKey: ['/api/account'],
    enabled: !!token,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['/api/profile'],
    enabled: !!token,
  });

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      companyName: user?.companyName || "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update profile');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile information has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const formatCurrency = (amount: string | null, currency = 'USD') => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(parseFloat(amount));
  };

  if (!user) {
    return <div>Please log in to access account settings</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
              {/* Header Section */}
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
                <p className="mt-1 text-gray-600">
                  Manage your account information and preferences.
                </p>
              </div>

              <div className="space-y-6">
                {/* Account Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <CreditCard className="h-5 w-5" />
                      <span>Account Overview</span>
                      {account && (
                        <DataBadge 
                          freshness={account.dataFreshness}
                          lastSync={account.lastSyncAt}
                        />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {accountLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="space-y-2">
                            <div className="h-4 bg-gray-200 rounded animate-pulse" />
                            <div className="h-6 bg-gray-200 rounded animate-pulse" />
                          </div>
                        ))}
                      </div>
                    ) : account ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Current Balance</Label>
                          <p className="text-2xl font-bold text-gray-900 mt-1">
                            {formatCurrency(account.balance, account.currency)}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Credit Limit</Label>
                          <p className="text-2xl font-bold text-gray-900 mt-1">
                            {formatCurrency(account.creditLimit, account.currency)}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Account Status</Label>
                          <p className={`text-2xl font-bold mt-1 ${account.isActive ? 'text-success' : 'text-error'}`}>
                            {account.isActive ? 'Active' : 'Inactive'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500">No account information available</p>
                    )}
                  </CardContent>
                </Card>

                {/* Profile Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <User className="h-5 w-5" />
                      <span>Profile Information</span>
                      <DataBadge freshness="cached" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name</Label>
                          <Input
                            id="firstName"
                            {...form.register("firstName")}
                            disabled={profileLoading}
                          />
                          {form.formState.errors.firstName && (
                            <p className="text-sm text-red-600">
                              {form.formState.errors.firstName.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input
                            id="lastName"
                            {...form.register("lastName")}
                            disabled={profileLoading}
                          />
                          {form.formState.errors.lastName && (
                            <p className="text-sm text-red-600">
                              {form.formState.errors.lastName.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            id="email"
                            type="email"
                            className="pl-10"
                            {...form.register("email")}
                            disabled={profileLoading}
                          />
                        </div>
                        {form.formState.errors.email && (
                          <p className="text-sm text-red-600">
                            {form.formState.errors.email.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="companyName">Company Name (Optional)</Label>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            id="companyName"
                            className="pl-10"
                            {...form.register("companyName")}
                            disabled={profileLoading}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          disabled={updateProfileMutation.isPending || profileLoading}
                          className="bg-netsuite-blue hover:bg-netsuite-light"
                        >
                          {updateProfileMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Save Changes
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                {/* Security Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Shield className="h-5 w-5" />
                      <span>Security Settings</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between py-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">Password</h3>
                          <p className="text-sm text-gray-500">
                            Last updated: Never
                          </p>
                        </div>
                        <Button variant="outline">
                          Change Password
                        </Button>
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between py-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h3>
                          <p className="text-sm text-gray-500">
                            Add an extra layer of security to your account
                          </p>
                        </div>
                        <Button variant="outline">
                          Enable 2FA
                        </Button>
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between py-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">Login History</h3>
                          <p className="text-sm text-gray-500">
                            View your recent login activity
                          </p>
                        </div>
                        <Button variant="outline">
                          View History
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Data Sync Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle>Data Synchronization Settings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h3 className="font-medium text-blue-800 mb-2">NetSuite Integration Status</h3>
                        <div className="text-sm text-blue-700 space-y-2">
                          <div className="flex items-center justify-between">
                            <span>Real-time Sync (Orders, Payments):</span>
                            <span className="font-medium">Active</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Batch Sync (Customer Data, History):</span>
                            <span className="font-medium">Every 10 minutes</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>NetSuite Customer ID:</span>
                            <span className="font-medium">{user.id}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between py-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">Notification Preferences</h3>
                          <p className="text-sm text-gray-500">
                            Configure how you receive updates about your account
                          </p>
                        </div>
                        <Button variant="outline">
                          Configure
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
