import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { MobileLayout } from "@/components/layout/mobile-layout";
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
  DollarSign,
  HandHelping,
  CalculatorIcon
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
      </div>



      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">Failed to load dashboard data. Please try again.</p>
        </div>
      )}

      {/* Quick Access Summary Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Sales Orders Card */}
        <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200 hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <Link href="/orders">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-full">
                  <ShoppingCart className="h-7 w-7 text-orange-600" />
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

        {/* Estimates Card */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <Link href="/estimates">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <CalculatorIcon className="h-7 w-7 text-blue-600" />
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

        {/* Support Cases Card */}
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <Link href="/support">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-full">
                  <HandHelping className="h-7 w-7 text-purple-600" />
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
      </div>







    </MobileLayout>
  );
}
