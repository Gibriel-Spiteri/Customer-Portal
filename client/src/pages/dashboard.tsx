import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { MobileLayout } from "@/components/layout/mobile-layout";
import { DataBadge } from "@/components/data-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { OrderDetailModal, Order } from "@/components/order-detail-modal";
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

interface EstimateDetail {
  id: string;
  estimateNumber: string;
  status: string;
  amount: string;
  currency: string;
  estimateDate: string;
  expiryDate: string;
  description?: string;
  memo?: string;
  tagFor?: string;
  items?: Array<{
    id?: string;
    name: string;
    itemName?: string;
    description?: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  totalAmount?: string;
  subtotal?: string;
  tax?: string;
  shipping?: string;
  discountTotal?: string;
  dataFreshness?: 'live' | 'cached';
  lastSyncAt?: string;
}

export default function Dashboard() {
  const { user, token } = useAuth();
  const [selectedEstimate, setSelectedEstimate] = useState<EstimateDetail | null>(null);
  const [loadingEstimateDetails, setLoadingEstimateDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
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

  const getEstimateStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      viewed: 'bg-purple-100 text-purple-800',
      open: 'bg-green-100 text-green-800',
      accepted: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
      rejected: 'bg-red-100 text-red-800',
      closed: 'bg-gray-100 text-gray-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
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
          Welcome back{user.companyName ? `, ${user.companyName}` : ''}
        </h1>
        <p className="mt-1 text-gray-600">
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
                <Button variant="ghost" size="sm" className="text-sm text-blue-600 hover:text-blue-700 px-1">
                  View All
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
                  <div
                    key={estimate.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer border border-gray-100"
                    onClick={async () => {
                      setSelectedEstimate({
                        id: estimate.id,
                        estimateNumber: estimate.estimateNumber,
                        status: estimate.status,
                        amount: estimate.amount,
                        currency: estimate.currency,
                        estimateDate: estimate.estimateDate,
                        expiryDate: estimate.expiryDate,
                        tagFor: estimate.tagFor,
                        memo: estimate.memo,
                        description: estimate.description,
                      });
                      setLoadingEstimateDetails(true);
                      try {
                        const response = await fetch(`/api/estimates/${estimate.id}`, {
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (response.ok) {
                          setSelectedEstimate(await response.json());
                        }
                      } catch (error) {
                        console.error('Failed to fetch estimate details:', error);
                      } finally {
                        setLoadingEstimateDetails(false);
                      }
                    }}
                  >
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
                <Button variant="ghost" size="sm" className="text-sm text-blue-600 hover:text-blue-700 px-1">
                  View All
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
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer border border-gray-100"
                    onClick={async () => {
                      setSelectedOrder({
                        id: order.id,
                        orderNumber: order.orderNumber,
                        status: order.status,
                        orderDate: order.orderDate,
                        totalAmount: order.totalAmount,
                        currency: order.currency,
                        tagFor: order.tagFor,
                        shipDate: null,
                        deliveryDate: null,
                        shippingAddress: null,
                        trackingNumber: null,
                        dataFreshness: order.dataFreshness,
                        lastSyncAt: order.lastSyncAt,
                      });
                      setLoadingOrderDetails(true);
                      try {
                        const response = await fetch(`/api/orders/${order.id}`, {
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (response.ok) {
                          setSelectedOrder(await response.json());
                        }
                      } catch (error) {
                        console.error('Failed to fetch order details:', error);
                      } finally {
                        setLoadingOrderDetails(false);
                      }
                    }}
                  >
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
                <Button variant="ghost" size="sm" className="text-sm text-blue-600 hover:text-blue-700 px-1">
                  View All
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
                    <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Available</p>
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
                        <div key={rebate.id} className="grid grid-cols-3 items-center py-2 px-3 rounded-md hover:bg-gray-50 border border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                              rebate.status === 'Earned' ? 'bg-green-400' :
                              rebate.status === 'Redeemed' ? 'bg-blue-400' :
                              rebate.status === 'Expired' ? 'bg-red-400' : 'bg-gray-400'
                            }`} />
                            <span className="text-xs text-gray-500">{formatDate(rebate.date)}</span>
                          </div>
                          <span className="text-sm font-medium tabular-nums text-right">{formatCurrency(rebate.amount)}</span>
                          <div className="text-right">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{rebate.status}</Badge>
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

      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        loadingOrderDetails={loadingOrderDetails}
      />

      <Dialog open={!!selectedEstimate} onOpenChange={() => setSelectedEstimate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Estimate #{selectedEstimate?.estimateNumber}</span>
              {selectedEstimate && (
                <Badge className={getEstimateStatusColor(selectedEstimate.status)}>
                  {selectedEstimate.status.charAt(0).toUpperCase() + selectedEstimate.status.slice(1)}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Details for estimate {selectedEstimate?.estimateNumber}
            </DialogDescription>
          </DialogHeader>

          {selectedEstimate && (
            <div className="space-y-6 mt-4">
              {(selectedEstimate.memo || selectedEstimate.tagFor) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedEstimate.tagFor && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">End User</h3>
                      <p className="text-base">{selectedEstimate.tagFor}</p>
                    </div>
                  )}
                  {selectedEstimate.memo && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Job ID</h3>
                      <p className="text-base">{selectedEstimate.memo}</p>
                    </div>
                  )}
                </div>
              )}

              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Estimate Date</h3>
                  <p className="text-base flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                    {formatDate(selectedEstimate.estimateDate)}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Total Amount</h3>
                  <p className="text-lg font-semibold">
                    {formatCurrency(selectedEstimate.amount || selectedEstimate.totalAmount || '0', selectedEstimate.currency)}
                  </p>
                </div>
              </div>

              {loadingEstimateDetails ? (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center">
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Line Items
                    </h3>
                    <div className="animate-pulse space-y-2">
                      <div className="h-12 bg-gray-200 rounded"></div>
                      <div className="h-12 bg-gray-200 rounded"></div>
                      <div className="h-12 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                </>
              ) : selectedEstimate.items && selectedEstimate.items.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center">
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Line Items
                    </h3>
                    <div className="space-y-2">
                      {(() => {
                        const allItems = selectedEstimate.items || [];

                        const displayItems = allItems.filter(item => {
                          const itemName = item.itemName || '';
                          const itemNameLower = itemName.toLowerCase();
                          const amount = parseFloat(String(item.amount || 0));

                          const isTaxItem = itemName.includes('NY_') ||
                            itemNameLower.includes('ny_suffolk') ||
                            itemNameLower.includes('ny_bhdl') ||
                            itemNameLower.includes('ny_ny') ||
                            (itemNameLower.includes('tax') && !itemNameLower.includes('we pay the tax'));
                          const isShippingItem = itemNameLower.includes('delivered') || itemNameLower.includes('ups') || itemNameLower.includes('shipping');

                          return Math.abs(amount) > 0.01 && !isTaxItem && !isShippingItem;
                        });

                        let productsTotal = 0;
                        let shippingTotal = 0;

                        allItems.forEach(item => {
                          const qty = Math.abs(parseFloat(String(item.quantity || 0)));
                          const rate = Math.abs(parseFloat(String(item.rate || 0)));
                          const amount = parseFloat(String(item.amount || 0));
                          const itemNameLower = (item.itemName || '').toLowerCase();

                          const itemTotal = qty > 0 ? qty * rate : Math.abs(amount);

                          if (itemNameLower.includes('delivered') || itemNameLower.includes('ups') || itemNameLower.includes('shipping')) {
                            shippingTotal += itemTotal;
                          } else if (
                            itemNameLower === 'customer discount' ||
                            itemNameLower.includes('% off') ||
                            itemNameLower.includes('% discount') ||
                            itemNameLower === 'discount' ||
                            itemNameLower.includes('we pay the tax') ||
                            itemNameLower.includes('we pay') ||
                            itemNameLower.includes('credit') ||
                            itemNameLower.includes('ny_') ||
                            (itemNameLower.includes('tax') && !itemNameLower.includes('we pay the tax'))
                          ) {
                          } else {
                            productsTotal += itemTotal;
                          }
                        });

                        const discountTotal = Math.abs(parseFloat(selectedEstimate.discountTotal || '0'));
                        const subtotal = productsTotal;

                        return (
                          <>
                            {displayItems.map((item, index) => {
                              const quantity = parseFloat(String(item.quantity || 0));
                              const rate = parseFloat(String(item.rate || 0));
                              const amount = parseFloat(String(item.amount || 0));
                              const itemNameLower = (item.itemName || '').toLowerCase();

                              const displayQuantity = Math.abs(quantity);
                              const displayRate = Math.abs(rate);

                              let displayAmount = displayQuantity > 0
                                ? displayQuantity * displayRate
                                : Math.abs(amount);

                              let bgColor = "bg-gray-50";
                              let textColor = "text-gray-900";
                              let descColor = "text-gray-600";
                              let isNegative = false;

                              if (itemNameLower === 'customer discount') {
                                bgColor = "bg-yellow-50";
                                textColor = "text-yellow-900";
                                descColor = "text-yellow-700";
                                isNegative = true;
                              } else if (itemNameLower.includes('credit') || itemNameLower.includes('we pay the tax') || itemNameLower.includes('we pay')) {
                                bgColor = "bg-green-50";
                                textColor = "text-green-900";
                                descColor = "text-green-700";
                                isNegative = true;
                              } else if (itemNameLower.includes('% off') || itemNameLower.includes('% discount') || itemNameLower === 'discount') {
                                bgColor = "bg-green-50";
                                textColor = "text-green-900";
                                descColor = "text-green-700";
                                isNegative = true;
                              }

                              return (
                                <div key={`item-${item.id || index}`} className={`${bgColor} p-3 rounded-lg`}>
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <h4 className={`font-medium ${textColor}`}>
                                        {item.itemName || item.name}
                                      </h4>
                                      {item.description &&
                                        !item.description.toLowerCase().includes('click print for description') && (
                                        <p className={`text-sm ${descColor} mt-1`}>{item.description}</p>
                                      )}
                                    </div>
                                    <div className="text-right ml-4 w-24">
                                      <p className={`font-semibold ${textColor}`}>
                                        {isNegative ? '-' : ''}${displayAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </p>
                                      {displayQuantity > 0 && (
                                        <p className={`text-sm ${descColor}`}>
                                          {displayQuantity} × ${displayRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            <div className="mt-4 pt-4 border-t-2 border-gray-300 space-y-2 bg-gray-50 p-4 rounded-lg">
                              <h4 className="font-semibold text-gray-900 mb-2">Summary</h4>

                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">SUBTOTAL</span>
                                <span className="font-medium">${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>

                              {discountTotal > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">DISCOUNTS</span>
                                  <span className="font-medium">-${discountTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              )}

                              {selectedEstimate.tax && parseFloat(selectedEstimate.tax) > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">TAX</span>
                                  <span className="font-medium">${parseFloat(selectedEstimate.tax).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              )}

                              {shippingTotal > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">SHIPPING CHARGES</span>
                                  <span className="font-medium">${shippingTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              )}

                              <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-300">
                                <span>TOTAL</span>
                                <span>${parseFloat(selectedEstimate.amount || selectedEstimate.totalAmount || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </>
              )}

              {selectedEstimate.description && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      Description
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-base">{selectedEstimate.description}</p>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setSelectedEstimate(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </MobileLayout>
  );
}
