import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { MobileLayout } from "@/components/layout/mobile-layout";
import { DataBadge } from "@/components/data-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

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
  Loader2,
  Phone,
  MapPin,
  Users,
  Smartphone
} from "lucide-react";

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

function ContactInfoEditor({ account, onDone }: { account: Account; onDone: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState(account.email || "");
  const [mobilePhone, setMobilePhone] = useState(account.mobilePhone || "");
  const [altPhone, setAltPhone] = useState(account.altPhone || "");

  // Best-effort prefill of structured address from the NetSuite address blob
  const addrLines = (account.defaultAddress || "").split("\n").map(l => l.trim()).filter(Boolean);
  const cityLine = addrLines.find(l => /\b[A-Z]{2}\s+\d{5}/.test(l)) || "";
  const cityMatch = cityLine.match(/^(.*?)[,\s]+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  const nonCityLines = addrLines.filter(l => l !== cityLine && !/^united states/i.test(l));
  // Drop a leading addressee line only when it has no street number and other lines remain
  const streetLines = nonCityLines.length > 1 && !/\d/.test(nonCityLines[0]) ? nonCityLines.slice(1) : nonCityLines;
  const initial = {
    addr1: streetLines[0] || "",
    addr2: streetLines[1] || "",
    city: cityMatch?.[1] || "",
    state: cityMatch?.[2] || "",
    zip: cityMatch?.[3] || "",
  };
  const [addr1, setAddr1] = useState(initial.addr1);
  const [addr2, setAddr2] = useState(initial.addr2);
  const [city, setCity] = useState(initial.city);
  const [state, setState] = useState(initial.state);
  const [zip, setZip] = useState(initial.zip);

  const emailChanged = email.trim().toLowerCase() !== (account.email || "").trim().toLowerCase();

  const save = useMutation({
    mutationFn: async () => {
      const body: any = {};
      if (emailChanged) {
        body.email = email.trim();
      }
      if (mobilePhone.trim() !== (account.mobilePhone || "").trim()) body.mobilePhone = mobilePhone.trim();
      if (altPhone.trim() !== (account.altPhone || "").trim()) body.altPhone = altPhone.trim();
      // Only send the address if the user actually changed it
      const addressDirty =
        addr1.trim() !== initial.addr1 ||
        addr2.trim() !== initial.addr2 ||
        city.trim() !== initial.city ||
        state.trim().toUpperCase() !== initial.state ||
        zip.trim() !== initial.zip;
      if (addressDirty) {
        body.address = { addr1: addr1.trim(), addr2: addr2.trim(), city: city.trim(), state: state.trim().toUpperCase(), zip: zip.trim() };
      }
      if (Object.keys(body).length === 0) throw new Error("No changes to save");
      await apiRequest("POST", "/api/account/update", body);
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Your contact information was updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/account"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      onDone();
    },
    onError: (e: any) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    save.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-mobile">Mobile Phone</Label>
          <Input id="edit-mobile" data-testid="input-mobile-phone" value={mobilePhone} onChange={e => setMobilePhone(e.target.value)} placeholder="(555) 555-1234" />
          <p className="text-xs text-gray-500">Must be a mobile number — we verify the line type.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-alt">Alternate Phone</Label>
          <Input id="edit-alt" data-testid="input-alt-phone" value={altPhone} onChange={e => setAltPhone(e.target.value)} placeholder="(555) 555-1234" />
          <p className="text-xs text-gray-500">Must be a landline number — we verify the line type.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-email">Email</Label>
        <Input id="edit-email" data-testid="input-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      </div>

      <div className="pt-2 border-t space-y-4">
        <Label className="text-sm font-medium text-gray-700">Mailing Address</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="edit-addr1">Street Address</Label>
            <Input id="edit-addr1" data-testid="input-addr1" value={addr1} onChange={e => setAddr1(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="edit-addr2">Street Address 2 (optional)</Label>
            <Input id="edit-addr2" data-testid="input-addr2" value={addr2} onChange={e => setAddr2(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-city">City</Label>
            <Input id="edit-city" data-testid="input-city" value={city} onChange={e => setCity(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-state">State</Label>
              <Input id="edit-state" data-testid="input-state" maxLength={2} value={state} onChange={e => setState(e.target.value.toUpperCase())} placeholder="NY" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-zip">ZIP</Label>
              <Input id="edit-zip" data-testid="input-zip" value={zip} onChange={e => setZip(e.target.value)} placeholder="11701" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button data-testid="button-save-contact" onClick={handleSave} disabled={save.isPending}>
          {save.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Save Changes"}
        </Button>
        <Button variant="outline" data-testid="button-cancel-contact" onClick={onDone} disabled={save.isPending}>Cancel</Button>
      </div>
    </div>
  );
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
  const [editingContact, setEditingContact] = useState(false);

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
      <MobileLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-semibold text-gray-700">Loading...</h2>
          </CardContent>
        </Card>
      </MobileLayout>
    );
  }

  if (!user || !token) {
    return (
      <MobileLayout>
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
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="max-w-4xl mx-auto">
              {/* Header Section */}
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
                <p className="mt-1 text-gray-600">
                  Manage your account information and preferences.
                </p>
              </div>

              <div className="space-y-6">
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
                      {account && !editingContact && (
                        <Button size="sm" variant="outline" className="ml-auto" data-testid="button-edit-contact" onClick={() => setEditingContact(true)}>
                          Edit
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {editingContact && account ? (
                      <ContactInfoEditor account={account} onDone={() => setEditingContact(false)} />
                    ) : (
                    <>
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
                    </>
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
                              <th className="pb-2 pl-4 font-medium text-sm text-gray-700">Role</th>
                            </tr>
                          </thead>
                          <tbody>
                            {contacts.map((contact) => (
                              <tr key={contact.id} className="border-b hover:bg-gray-50">
                                <td className="py-3 pr-4">
                                  <span className="font-medium text-gray-900">{contact.fullName}</span>
                                </td>
                                <td className="py-3 pl-4">
                                  {contact.isPrimary ? (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">
                                      Primary Contact
                                    </span>
                                  ) : (
                                    <span className="text-sm text-gray-600">{contact.role || '—'}</span>
                                  )}
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
                    {user?.isNetSuiteUser && account?.customerNumber ? (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Shield className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium text-blue-900">NetSuite Customer Number</p>
                            <p className="text-lg font-mono font-semibold text-blue-700" data-testid="text-customer-number">#{account.customerNumber}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500">No customer number available</p>
                    )}
                  </CardContent>
                </Card>

              </div>
      </div>
    </MobileLayout>
  );
}
