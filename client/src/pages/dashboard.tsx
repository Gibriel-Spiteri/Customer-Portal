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
  ArrowRight
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
  const { data: estimatesData, isLoading: estimatesLoading } = useQuery<{ items: EstimateData[] }>({
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
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user.firstName}
        </h1>
        <p className="mt-1 text-gray-600">
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

      {/* NetSuite Estimates Section */}
      {estimatesData?.items && estimatesData.items.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Estimates from NetSuite</CardTitle>
              <div className="flex items-center space-x-2">
                <DataBadge freshness="live" />
                <Link href="/estimates">
                  <Button variant="ghost" size="sm">
                    View all
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {estimatesLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <div className="text-right space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {estimatesData.items.map((estimate) => (
                  <div key={estimate.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        Estimate #{estimate.documentNumber}
                      </p>
                      <p className="text-sm text-gray-500">
                        Date: {formatDate(estimate.date)}
                      </p>
                      {estimate.expirationDate && (
                        <p className="text-xs text-gray-400">
                          Expires: {formatDate(estimate.expirationDate)}
                        </p>
                      )}
                      {estimate.memo && (
                        <p className="text-xs text-gray-600 mt-1 truncate max-w-xs">
                          {estimate.memo}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(estimate.total, estimate.currency)}
                      </p>
                      <Badge className={getStatusColor(estimate.status?.toLowerCase() || 'open')}>
                        {estimate.status || 'Open'}
                      </Badge>
                      {estimate.location && (
                        <p className="text-xs text-gray-500 mt-1">
                          {estimate.location}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Recent Orders */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Recent Orders</CardTitle>
                      <div className="flex items-center space-x-2">
                        <DataBadge freshness="live" />
                        <Link href="/orders">
                          <Button variant="ghost" size="sm">
                            View all
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex justify-between items-center">
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                            <div className="text-right space-y-2">
                              <Skeleton className="h-4 w-20" />
                              <Skeleton className="h-5 w-16" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : dashboardData?.recentOrders?.length ? (
                      <div className="space-y-4">
                        {dashboardData.recentOrders.slice(0, 5).map((order) => (
                          <div key={order.id} className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {order.orderNumber}
                              </p>
                              <p className="text-sm text-gray-500">
                                Order Date: {formatDate(order.orderDate)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">
                                {formatCurrency(order.totalAmount, order.currency)}
                              </p>
                              <Badge className={getStatusColor(order.status)}>
                                {order.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No recent orders</p>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Payments */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Payment Activity</CardTitle>
                      <div className="flex items-center space-x-2">
                        <DataBadge freshness="live" />
                        <Link href="/payments">
                          <Button variant="ghost" size="sm">
                            View all
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex justify-between items-center">
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                            <div className="text-right">
                              <Skeleton className="h-4 w-20" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : dashboardData?.recentPayments?.length ? (
                      <div className="space-y-4">
                        {dashboardData.recentPayments.slice(0, 5).map((payment) => (
                          <div key={payment.id} className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                Payment {payment.paymentNumber}
                              </p>
                              <p className="text-sm text-gray-500">
                                {formatDate(payment.paymentDate)} • {payment.paymentMethod}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-success">
                                +{formatCurrency(payment.amount, payment.currency)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No recent payments</p>
                    )}
                  </CardContent>
                </Card>
              </div>



        {/* Sync Status Detail */}
        <SyncStatusDetail />
    </MobileLayout>
  );
}
