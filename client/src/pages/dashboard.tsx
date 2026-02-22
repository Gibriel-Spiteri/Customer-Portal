import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { MobileLayout } from "@/components/layout/mobile-layout";
import { DataBadge } from "@/components/data-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { 
  CreditCard, 
  ShoppingCart, 
  FileText, 
  TrendingUp,
  Download,
  Phone,
  ArrowRight,
  DollarSign,
  HeadphonesIcon,
  CalculatorIcon,
  Calendar,
  Package,
  Wallet,
  CheckCircle,
  Clock,
  XCircle
} from "lucide-react";
import { Link } from "wouter";

interface DashboardData {
  account: {
    balance: string;
    currency: string;
    dataFreshness: 'live' | 'cached';
    lastSyncAt: string;
    crdRebateBalance?: string;
  } | null;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    orderDate: string;
    totalAmount: string;
    currency: string;
    tagFor?: string;
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
  totalCounts?: {
    activeOrders: number;
    activeEstimates: number;
    openCases: number;
  };
}

interface EstimateData {
  id: string;
  estimateNumber: string;
  status: string;
  amount: string;
  currency: string;
  estimateDate: string;
  expiryDate: string;
  description: string;
  memo: string;
  tagFor: string;
  customerName: string;
  dataFreshness: 'live' | 'cached';
  lastSyncAt: string;
}

interface CRDRebatesResponse {
  rebates: Array<{
    id: string;
    date: string;
    amount: string;
    type: string;
    reversed: boolean;
    salesOrder: string;
    expirationDate: string | null;
    status: 'Earned' | 'Redeemed' | 'Expired' | 'Return' | 'Accommodation' | 'Unknown';
  }>;
  summary: {
    totalAvailable: string;
    totalExpired: string;
    totalRedeemed: string;
    totalRebates: number;
  };
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

  const { data: crdData, isLoading: crdLoading } = useQuery<CRDRebatesResponse>({
    queryKey: ['/api/crd-rebates'],
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
      </div>



      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">Failed to load dashboard data. Please try again.</p>
        </div>
      )}

      {/* Quick Access Summary Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Estimates Card */}
        <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200 hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <Link href="/estimates">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-full">
                  <CalculatorIcon className="h-7 w-7 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Estimates</h3>
                  <p className="text-sm text-gray-600">
                    {isLoading ? (
                      <Skeleton className="h-4 w-20" />
                    ) : (
                      `${dashboardData?.totalCounts?.activeEstimates || dashboardData?.recentEstimates?.length || 0} active quotes`
                    )}
                  </p>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* Sales Orders Card */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <Link href="/orders">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <ShoppingCart className="h-7 w-7 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Sales Orders</h3>
                  <p className="text-sm text-gray-600">
                    {isLoading ? (
                      <Skeleton className="h-4 w-20" />
                    ) : (
                      `${dashboardData?.totalCounts?.activeOrders || dashboardData?.recentOrders?.length || 0} active orders`
                    )}
                  </p>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* Consumers Cash Card */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <Link href="/consumers-cash">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <DollarSign className="h-7 w-7 text-green-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Consumers Cash</h3>
                  <p className="text-sm text-gray-600">
                    {isLoading ? (
                      <Skeleton className="h-4 w-20" />
                    ) : dashboardData?.account?.crdRebateBalance ? (
                      `Balance: ${formatCurrency(dashboardData.account.crdRebateBalance)}`
                    ) : (
                      'View CRD rebate rewards'
                    )}
                  </p>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* Support Cases Card */}
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <Link href="/support">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-full">
                  <HeadphonesIcon className="h-7 w-7 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Support</h3>
                  <p className="text-sm text-gray-600">
                    {isLoading ? (
                      <Skeleton className="h-4 w-20" />
                    ) : (
                      `${dashboardData?.totalCounts?.openCases || 0} open cases`
                    )}
                  </p>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Three-Panel Section: Recent Estimates, Recent Sales Orders & Consumers Cash Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Estimates Panel */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CalculatorIcon className="h-5 w-5 text-orange-500" />
                Recent Estimates
              </CardTitle>
              <Link href="/estimates">
                <Button variant="ghost" size="sm" className="text-sm text-blue-600 hover:text-blue-700 px-2">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {estimatesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : estimatesData && estimatesData.length > 0 ? (
              <div className="space-y-2">
                {estimatesData.slice(0, 5).map((estimate) => (
                  <Link key={estimate.id} href="/estimates">
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer border border-gray-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-1.5 bg-orange-50 rounded-md shrink-0">
                          <FileText className="h-4 w-4 text-orange-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">#{estimate.estimateNumber}</p>
                          {estimate.tagFor && (
                            <p className="text-xs text-gray-500 truncate">{estimate.tagFor}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold">{formatCurrency(estimate.amount, estimate.currency)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CalculatorIcon className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No recent estimates</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales Orders Panel */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-blue-500" />
                Recent Sales Orders
              </CardTitle>
              <Link href="/orders">
                <Button variant="ghost" size="sm" className="text-sm text-blue-600 hover:text-blue-700 px-2">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : dashboardData?.recentOrders && dashboardData.recentOrders.length > 0 ? (
              <div className="space-y-2">
                {dashboardData.recentOrders.slice(0, 5).map((order) => (
                  <Link key={order.id} href="/orders">
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer border border-gray-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-1.5 bg-blue-50 rounded-md shrink-0">
                          <Package className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">#{order.orderNumber}</p>
                          {order.tagFor && (
                            <p className="text-xs text-gray-500 truncate">{order.tagFor}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold">{formatCurrency(order.totalAmount, order.currency)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No recent orders</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Consumers Cash Summary Panel */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                Consumers Cash Summary
              </CardTitle>
              <Link href="/consumers-cash">
                <Button variant="ghost" size="sm" className="text-sm text-blue-600 hover:text-blue-700 px-2">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {crdLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            ) : crdData?.summary ? (
              <div className="space-y-4">
                {/* Available Balance & Redeemed on same line */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-3 text-center">
                    <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Available Balance</p>
                    <p className="text-lg font-bold text-green-800 mt-0.5">{formatCurrency(crdData.summary.totalAvailable)}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Redeemed</p>
                    <p className="text-lg font-bold text-gray-900 mt-0.5">{formatCurrency(crdData.summary.totalRedeemed)}</p>
                  </div>
                </div>

                {/* Recent Rebates */}
                {crdData.rebates.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Recent Activity</p>
                    <div className="space-y-1.5">
                      {crdData.rebates.slice(0, 3).map((rebate) => (
                        <div key={rebate.id} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-gray-50 border border-gray-100">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                              rebate.status === 'Earned' ? 'bg-green-400' :
                              rebate.status === 'Redeemed' ? 'bg-blue-400' :
                              rebate.status === 'Expired' ? 'bg-red-400' : 'bg-gray-400'
                            }`} />
                            <span className="text-xs text-gray-500">{formatDate(rebate.date)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{formatCurrency(rebate.amount)}</span>
                            <Badge variant="outline" className="text-xs">{rebate.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <DollarSign className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No rebate data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>




    </MobileLayout>
  );
}
