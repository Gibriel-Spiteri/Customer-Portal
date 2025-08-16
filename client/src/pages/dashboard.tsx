import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { MobileLayout } from "@/components/layout/mobile-layout";
import { SyncStatusDetail } from "@/components/sync-status";
import { DataBadge } from "@/components/data-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CreditCard, 
  ShoppingCart, 
  FileText, 
  TrendingUp,
  Download,
  Phone,
  ArrowRight,
  Coins,
  HeadphonesIcon,
  CalculatorIcon
} from "lucide-react";
import { Link } from "wouter";

interface DashboardData {
  account: {
    balance: string;
    currency: string;
    dataFreshness: 'live' | 'cached';
    lastSyncAt: string;
  } | null;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    orderDate: string;
    totalAmount: string;
    currency: string;
    dataFreshness: 'live' | 'cached';
    lastSyncAt: string;
  }>;
  recentPayments: Array<{
    id: string;
    paymentNumber: string;
    amount: string;
    paymentDate: string;
    paymentMethod: string;
    status: string;
    currency: string;
    dataFreshness: 'live' | 'cached';
    lastSyncAt: string;
  }>;
  outstandingInvoices: Array<{
    id: string;
    invoiceNumber: string;
    balanceAmount: string;
    dueDate: string;
    currency: string;
    dataFreshness: 'live' | 'cached';
    lastSyncAt: string;
  }>;
  recentEstimates?: Array<{
    id: string;
    estimateNumber: string;
    status: string;
    amount: string;
    estimateDate: string;
    expiryDate: string;
    customerName: string;
  }>;
  recentCases?: Array<{
    id: string;
    caseNumber: string;
    subject: string;
    status: string;
    priority: string;
    createdDate: string;
    lastModified: string;
  }>;
  pendingOrdersCount: number;
  monthlyTotal: string;
}

interface EstimateData {
  id: string;
  documentNumber: string;
  date: string;
  expirationDate: string;
  status: string;
  total: string;
  subtotal: string;
  tax: string;
  shipping: string;
  memo: string;
  customerName: string;
  location: string;
  currency: string;
}

export default function Dashboard() {
  const { user, token } = useAuth();

  const { data: dashboardData, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['/api/dashboard'],
    enabled: !!token,
  });
  
  // Fetch estimates from NetSuite
  const { data: estimatesData, isLoading: estimatesLoading } = useQuery<EstimateData[]>({
    queryKey: ['/api/estimates?limit=5'],
    enabled: !!token,
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      shipped: 'bg-blue-100 text-blue-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      open: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      processed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      closed: 'bg-gray-100 text-gray-800',
      'in progress': 'bg-blue-100 text-blue-800',
      'on hold': 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800',
      urgent: 'bg-red-100 text-red-800',
      '1': 'bg-red-100 text-red-800', // High
      '2': 'bg-yellow-100 text-yellow-800', // Medium
      '3': 'bg-green-100 text-green-800', // Low
    };
    return colors[priority?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount: string, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!user) {
    // Don't render anything while auth is still loading
    return null;
  }

  return (
    <MobileLayout>
      {/* Welcome Section */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back{user.firstName ? `, ${user.firstName}` : ''}
        </h1>
        <p className="mt-1 text-gray-600">
          {user.companyName ? (
            <span className="font-medium">{user.companyName} - </span>
          ) : null}
          Here's what's happening with your account today.
        </p>
        {/* Debugging info - to be removed later */}
        {user.isNetSuiteUser && user.netsuiteCustomerId && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs font-mono">
            <span className="text-blue-600 font-semibold">NetSuite:</span> Customer # {user.netsuiteCustomerId}
          </div>
        )}
      </div>



      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">Failed to load dashboard data. Please try again.</p>
        </div>
      )}

      {/* Quick Access Summary Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Sales Orders Card */}
        <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
          <CardContent className="p-4">
            <Link href="/orders">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="p-3 bg-orange-100 rounded-full">
                  <ShoppingCart className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Sales Orders</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {isLoading ? (
                      <Skeleton className="h-4 w-16 mx-auto" />
                    ) : (
                      `${dashboardData?.recentOrders?.length || 0} orders`
                    )}
                  </p>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* Estimates Card */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-4">
            <Link href="/estimates">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="p-3 bg-blue-100 rounded-full">
                  <CalculatorIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Estimates</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {isLoading ? (
                      <Skeleton className="h-4 w-16 mx-auto" />
                    ) : (
                      `${dashboardData?.recentEstimates?.length || 0} quotes`
                    )}
                  </p>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* Consumers Cash Card */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <Link href="/consumers-cash">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="p-3 bg-green-100 rounded-full">
                  <Coins className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Consumers Cash</h3>
                  <p className="text-xs text-gray-600 mt-1">View rewards</p>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* Support Cases Card */}
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-4">
            <Link href="/support">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="p-3 bg-purple-100 rounded-full">
                  <HeadphonesIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Support Cases</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {isLoading ? (
                      <Skeleton className="h-4 w-16 mx-auto" />
                    ) : (
                      `${dashboardData?.recentCases?.filter(c => c.status?.toLowerCase() !== 'closed').length || 0} open`
                    )}
                  </p>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Account Balance */}
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <CreditCard className="h-8 w-8 netsuite-blue" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Account Balance
                          </dt>
                          <dd className="flex items-center space-x-2">
                            {isLoading ? (
                              <Skeleton className="h-6 w-24" />
                            ) : (
                              <>
                                <span className="text-lg font-medium text-gray-900">
                                  {dashboardData?.account ? 
                                    formatCurrency(dashboardData.account.balance, dashboardData.account.currency) :
                                    '$0.00'
                                  }
                                </span>
                                {dashboardData?.account && (
                                  <DataBadge 
                                    freshness={dashboardData.account.dataFreshness}
                                    lastSync={dashboardData.account.lastSyncAt}
                                  />
                                )}
                              </>
                            )}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Pending Orders */}
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <ShoppingCart className="h-8 w-8 text-warning" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Pending Orders
                          </dt>
                          <dd className="flex items-center space-x-2">
                            {isLoading ? (
                              <Skeleton className="h-6 w-16" />
                            ) : (
                              <>
                                <span className="text-lg font-medium text-gray-900">
                                  {dashboardData?.pendingOrdersCount || 0}
                                </span>
                                <DataBadge freshness="live" />
                              </>
                            )}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Outstanding Invoices */}
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <FileText className="h-8 w-8 text-success" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Outstanding Invoices
                          </dt>
                          <dd className="flex items-center space-x-2">
                            {isLoading ? (
                              <Skeleton className="h-6 w-24" />
                            ) : (
                              <>
                                <span className="text-lg font-medium text-gray-900">
                                  {dashboardData?.outstandingInvoices?.length || 0}
                                </span>
                                <DataBadge freshness="cached" />
                              </>
                            )}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Monthly Total */}
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <TrendingUp className="h-8 w-8 netsuite-light" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            This Month
                          </dt>
                          <dd className="flex items-center space-x-2">
                            {isLoading ? (
                              <Skeleton className="h-6 w-24" />
                            ) : (
                              <>
                                <span className="text-lg font-medium text-gray-900">
                                  {formatCurrency(dashboardData?.monthlyTotal || '0')}
                                </span>
                                <DataBadge freshness="cached" />
                              </>
                            )}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>





        {/* Sync Status Detail */}
        <SyncStatusDetail />
    </MobileLayout>
  );
}
