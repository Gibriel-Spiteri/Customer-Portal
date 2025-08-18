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
import { useEffect } from "react";
import { 
  User, 
  Mail, 
  Building2, 
  CreditCard,
  Shield,
  Save,
  Loader2,
  Phone,
  MapPin,
  Users,
  Smartphone
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { ChangePassword } from "@/components/change-password";

interface Account {
  id: string;
  customerNumber?: string;
  balance: string;
  creditLimit: string | null;
  currency: string;
  isActive: boolean;
  phone?: string;
  altPhone?: string;
  mobilePhone?: string;
  defaultAddress?: string;
  email?: string;
  dataFreshness: 'live' | 'cached';
  lastSyncAt: string;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  mobilePhone?: string;
  bestPhone?: string;
  title?: string;
  role?: string;
  address?: string;
  isPrimary: boolean;
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
  const { user, token, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: account, isLoading: accountLoading, error: accountError } = useQuery<Account>({
    queryKey: ['/api/account'],
    enabled: !!token && !!user,
    retry: false,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['/api/profile'],
    enabled: !!token && !!user,
    retry: false,
  });

  const { data: contacts, isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ['/api/customer-contacts'],
    enabled: !!token && !!user,
    retry: false,
  });

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      companyName: "",
    },
  });

  // Update form values when profile data loads from the API
  useEffect(() => {
    if (profile) {
      form.reset({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email || "",
        companyName: profile.companyName || "",
      });
    }
  }, [profile, form]);

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

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="py-6">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
                <Card>
                  <CardContent className="py-12 text-center">
                    <Loader2 className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-spin" />
                    <h2 className="text-xl font-semibold text-gray-700">Loading...</h2>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Check if user is not authenticated
  if (!user || !token) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="py-6">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
                <Card>
                  <CardContent className="py-12 text-center">
                    <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-700 mb-2">Authentication Required</h2>
                    <p className="text-gray-500 mb-6">Please log in to view your account settings</p>
                    <Button onClick={() => window.location.href = '/login'}>
                      Go to Login
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
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

                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Phone className="h-5 w-5" />
                      <span>Contact Information</span>
                      {account && (
                        <DataBadge 
                          freshness={account.dataFreshness}
                          lastSync={account.lastSyncAt}
                        />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {account?.phone && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-gray-500">Primary Phone</Label>
                          <div className="flex items-center space-x-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <p className="text-gray-900">{account.phone}</p>
                          </div>
                        </div>
                      )}
                      
                      {account?.altPhone && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-gray-500">Alternate Phone</Label>
                          <div className="flex items-center space-x-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <p className="text-gray-900">{account.altPhone}</p>
                          </div>
                        </div>
                      )}
                      
                      {account?.mobilePhone && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-gray-500">Mobile Phone</Label>
                          <div className="flex items-center space-x-2">
                            <Smartphone className="h-4 w-4 text-gray-400" />
                            <p className="text-gray-900">{account.mobilePhone}</p>
                          </div>
                        </div>
                      )}
                      
                      {account?.email && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-gray-500">Email</Label>
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4 text-gray-400" />
                            <p className="text-gray-900">{account.email}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {account?.defaultAddress && (
                      <div className="mt-6 pt-6 border-t">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-gray-500">Default Address</Label>
                          <div className="flex items-start space-x-2">
                            <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                            <p className="text-gray-900 whitespace-pre-line">{account.defaultAddress}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {!account?.phone && !account?.altPhone && !account?.mobilePhone && !account?.email && !account?.defaultAddress && (
                      <p className="text-gray-500">No contact information available</p>
                    )}
                  </CardContent>
                </Card>

                {/* Authorized Users */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Users className="h-5 w-5" />
                      <span>Authorized Users</span>
                      <DataBadge freshness="live" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {contactsLoading ? (
                      <div className="animate-pulse">
                        <div className="h-10 bg-gray-100 rounded mb-2" />
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="h-12 bg-gray-50 rounded mb-1" />
                        ))}
                      </div>
                    ) : contacts && contacts.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="pb-2 pr-4 font-medium text-sm text-gray-700">Name</th>
                              <th className="pb-2 px-4 font-medium text-sm text-gray-700">Role</th>
                              <th className="pb-2 px-4 font-medium text-sm text-gray-700">Title</th>
                              <th className="pb-2 px-4 font-medium text-sm text-gray-700">Email</th>
                              <th className="pb-2 pl-4 font-medium text-sm text-gray-700">Phone</th>
                            </tr>
                          </thead>
                          <tbody>
                            {contacts.map((contact) => (
                              <tr key={contact.id} className="border-b hover:bg-gray-50">
                                <td className="py-3 pr-4">
                                  <span className="font-medium text-gray-900">{contact.fullName}</span>
                                </td>
                                <td className="py-3 px-4">
                                  {contact.isPrimary ? (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">
                                      Primary Contact
                                    </span>
                                  ) : (
                                    <span className="text-sm text-gray-600">{contact.role || '—'}</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-600">
                                  {contact.title || <span className="text-gray-400">—</span>}
                                </td>
                                <td className="py-3 px-4 text-sm">
                                  {contact.email ? (
                                    <a 
                                      href={`mailto:${contact.email}`}
                                      className="text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      {contact.email}
                                    </a>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </td>
                                <td className="py-3 pl-4 text-sm text-gray-600">
                                  {contact.bestPhone || contact.phone || contact.mobilePhone || 
                                    <span className="text-gray-400">—</span>
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500">No contacts found for this customer</p>
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
                    {/* NetSuite Customer Number */}
                    {user?.isNetSuiteUser && account?.customerNumber && (
                      <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Shield className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium text-blue-900">NetSuite Customer Number</p>
                            <p className="text-lg font-mono font-semibold text-blue-700">#{account.customerNumber}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
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

                {/* Password Change */}
                <ChangePassword />

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
