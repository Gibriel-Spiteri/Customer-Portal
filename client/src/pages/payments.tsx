import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useSync } from "@/contexts/sync-context";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { DataBadge } from "@/components/data-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Filter, 
  RefreshCw, 
  CreditCard,
  CheckCircle,
  Clock,
  XCircle,
  DollarSign,
  Calendar
} from "lucide-react";
import { useState } from "react";

interface Payment {
  id: string;
  paymentNumber: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string | null;
  status: string;
  currency: string;
  dataFreshness: 'live' | 'cached';
  lastSyncAt: string;
}

export default function Payments() {
  const { user, token } = useAuth();
  const { triggerLiveSync } = useSync();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: payments, isLoading, error, refetch } = useQuery<Payment[]>({
    queryKey: ['/api/payments'],
    enabled: !!token,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await triggerLiveSync('payments');
      await refetch();
      toast({
        title: "Payments Updated",
        description: "Your payment data has been refreshed with the latest information from NetSuite.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Unable to refresh payment data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, JSX.Element> = {
      pending: <Clock className="h-4 w-4" />,
      processed: <CheckCircle className="h-4 w-4" />,
      failed: <XCircle className="h-4 w-4" />,
      refunded: <DollarSign className="h-4 w-4" />,
    };
    return icons[status] || <Clock className="h-4 w-4" />;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-blue-100 text-blue-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getMethodIcon = (method: string) => {
    const icons: Record<string, JSX.Element> = {
      credit_card: <CreditCard className="h-4 w-4" />,
      check: <Calendar className="h-4 w-4" />,
      bank_transfer: <DollarSign className="h-4 w-4" />,
      cash: <DollarSign className="h-4 w-4" />,
    };
    return icons[method] || <DollarSign className="h-4 w-4" />;
  };

  const formatCurrency = (amount: string, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatPaymentMethod = (method: string) => {
    const methods: Record<string, string> = {
      credit_card: 'Credit Card',
      check: 'Check',
      bank_transfer: 'Bank Transfer',
      cash: 'Cash',
    };
    return methods[method] || method;
  };

  const filteredPayments = payments?.filter(payment => {
    const matchesSearch = payment.paymentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (payment.referenceNumber && payment.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    const matchesMethod = methodFilter === 'all' || payment.paymentMethod === methodFilter;
    return matchesSearch && matchesStatus && matchesMethod;
  }) || [];

  if (!user) {
    return <div>Please log in to view your payments</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {/* Header Section */}
              <div className="mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Payment Activity</h1>
                    <p className="mt-1 text-gray-600">
                      View your payment history and track transaction status from NetSuite.
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <DataBadge freshness="live" />
                    <Button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      variant="outline"
                      size="sm"
                    >
                      {isRefreshing ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Refresh
                    </Button>
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <CheckCircle className="h-8 w-8 text-success" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">Total Processed</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(
                            payments?.filter(p => p.status === 'processed')
                              .reduce((sum, p) => sum + parseFloat(p.amount), 0).toString() || '0'
                          )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Clock className="h-8 w-8 text-warning" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">Pending</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {payments?.filter(p => p.status === 'pending').length || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <XCircle className="h-8 w-8 text-error" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">Failed</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {payments?.filter(p => p.status === 'failed').length || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <DollarSign className="h-8 w-8 netsuite-blue" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">This Month</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(
                            payments?.filter(p => {
                              const paymentMonth = new Date(p.paymentDate).getMonth();
                              const currentMonth = new Date().getMonth();
                              return paymentMonth === currentMonth && p.status === 'processed';
                            }).reduce((sum, p) => sum + parseFloat(p.amount), 0).toString() || '0'
                          )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Filters and Search */}
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search by payment number or reference..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="sm:w-48">
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger>
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="processed">Processed</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                          <SelectItem value="refunded">Refunded</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:w-48">
                      <Select value={methodFilter} onValueChange={setMethodFilter}>
                        <SelectTrigger>
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue placeholder="Filter by method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Methods</SelectItem>
                          <SelectItem value="credit_card">Credit Card</SelectItem>
                          <SelectItem value="check">Check</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Error State */}
              {error && (
                <Card className="mb-6 border-red-200 bg-red-50">
                  <CardContent className="pt-6">
                    <p className="text-red-800">Failed to load payments. Please try refreshing the page.</p>
                  </CardContent>
                </Card>
              )}

              {/* Payments List */}
              <div className="space-y-4">
                {isLoading ? (
                  // Loading Skeletons
                  [...Array(5)].map((_, i) => (
                    <Card key={i}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="space-y-2">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                          <div className="space-y-2">
                            <Skeleton className="h-6 w-24" />
                            <Skeleton className="h-5 w-16" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-full" />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : filteredPayments.length > 0 ? (
                  filteredPayments.map((payment) => (
                    <Card key={payment.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              Payment {payment.paymentNumber}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {formatDate(payment.paymentDate)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-success">
                              {formatCurrency(payment.amount, payment.currency)}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge className={getStatusColor(payment.status)}>
                                {getStatusIcon(payment.status)}
                                <span className="ml-1 capitalize">{payment.status}</span>
                              </Badge>
                              <DataBadge 
                                freshness={payment.dataFreshness}
                                lastSync={payment.lastSyncAt}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-500">Payment Method:</span>
                            <div className="flex items-center mt-1">
                              {getMethodIcon(payment.paymentMethod)}
                              <span className="ml-2 text-gray-900">
                                {formatPaymentMethod(payment.paymentMethod)}
                              </span>
                            </div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-500">Reference Number:</span>
                            <p className="text-gray-900 mt-1">
                              {payment.referenceNumber || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-500">Status:</span>
                            <p className="text-gray-900 mt-1 capitalize">
                              {payment.status}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Payments Found</h3>
                        <p className="text-gray-600">
                          {searchTerm || statusFilter !== 'all' || methodFilter !== 'all'
                            ? 'No payments match your current filters.'
                            : 'You don\'t have any payments yet.'
                          }
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Make Payment Button */}
              <Card className="mt-6">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Need to Make a Payment?</h3>
                    <p className="text-gray-600 mb-4">
                      Contact our billing department to process a new payment.
                    </p>
                    <Button className="bg-netsuite-blue hover:bg-netsuite-light">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Contact Billing
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
