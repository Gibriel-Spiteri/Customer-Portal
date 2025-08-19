import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useSync } from "@/contexts/sync-context";
import { MobileLayout } from "@/components/layout/mobile-layout";
import { DataBadge } from "@/components/data-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Filter, 
  RefreshCw, 
  Eye,
  Truck,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  MapPin,
  CreditCard,
  FileText,
  Calendar,
  ShoppingCart,
  AlertCircle,
  DollarSign,
  TrendingUp
} from "lucide-react";
import { useState } from "react";
import { queryClient } from "@/lib/queryClient";

interface OrderItem {
  id: string;
  lineNumber: number;
  itemName: string;
  quantity: number;
  rate: string;
  amount: string;
  description: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: string;
  shipDate: string | null;
  deliveryDate: string | null;
  totalAmount: string;
  subtotal?: string;
  tax?: string;
  shipping?: string;
  currency: string;
  shippingAddress: any;
  trackingNumber: string | null;
  items?: OrderItem[];
  dataFreshness: 'live' | 'cached';
  lastSyncAt: string;
}

export default function Orders() {
  const { user, token } = useAuth();
  const { triggerLiveSync } = useSync();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [activeView, setActiveView] = useState("ready-for-delivery");

  const { data: orders, isLoading, error, refetch } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
    enabled: !!token,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await triggerLiveSync('orders');
      await refetch();
      toast({
        title: "Orders Updated",
        description: "Your order data has been refreshed with the latest information from NetSuite.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Unable to refresh order data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, JSX.Element> = {
      'pending': <Clock className="h-4 w-4" />,
      'pending approval': <Clock className="h-4 w-4" />,
      'pending fulfillment': <Package className="h-4 w-4" />,
      'pending billing': <CreditCard className="h-4 w-4" />,
      'partially fulfilled': <Truck className="h-4 w-4" />,
      'fully billed': <CheckCircle className="h-4 w-4" />,
      'closed': <CheckCircle className="h-4 w-4" />,
      'cancelled': <XCircle className="h-4 w-4" />,
    };
    return icons[status] || <Clock className="h-4 w-4" />;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'pending approval': 'bg-orange-100 text-orange-800',
      'pending fulfillment': 'bg-blue-100 text-blue-800',
      'pending billing': 'bg-purple-100 text-purple-800',
      'partially fulfilled': 'bg-indigo-100 text-indigo-800',
      'fully billed': 'bg-green-100 text-green-800',
      'closed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount: string, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Filter orders based on active view
  const getFilteredOrdersByView = (viewType: string) => {
    if (!orders) return [];
    
    let viewFiltered = [...orders];
    
    // Apply view-specific filtering
    switch (viewType) {
      case 'ready-for-delivery':
        // Show orders that are fulfilled and ready for delivery
        viewFiltered = viewFiltered.filter(order => 
          order.status === 'partially fulfilled' || 
          order.status === 'pending billing' ||
          (order.status === 'fully billed' && !order.deliveryDate)
        );
        break;
        
      case 'recent':
        // Show orders from the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        viewFiltered = viewFiltered.filter(order => 
          new Date(order.orderDate) >= thirtyDaysAgo
        );
        break;
      
      case 'pending':
        // Show orders with pending statuses
        viewFiltered = viewFiltered.filter(order => 
          order.status.toLowerCase().includes('pending') || 
          order.status === 'partially fulfilled'
        );
        break;
      
      case 'high-value':
        // Show orders above $10,000
        viewFiltered = viewFiltered.filter(order => 
          parseFloat(order.totalAmount) >= 10000
        );
        break;
        
      case 'completed':
        // Show completed orders
        viewFiltered = viewFiltered.filter(order => 
          order.status === 'closed' || 
          order.status === 'fully billed'
        );
        break;
      
      case 'all':
      default:
        // Show all orders
        break;
    }
    
    // Apply search and status filters
    return viewFiltered.filter(order => {
      const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  };
  
  const filteredOrders = getFilteredOrdersByView(activeView);

  if (!user) {
    return <div>Please log in to view your orders</div>;
  }

  // Get counts for each view
  const getViewCounts = () => {
    if (!orders) return { readyForDelivery: 0, recent: 0, pending: 0, highValue: 0, completed: 0, all: 0 };
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return {
      readyForDelivery: orders.filter(order => 
        order.status === 'partially fulfilled' || 
        order.status === 'pending billing' ||
        (order.status === 'fully billed' && !order.deliveryDate)
      ).length,
      recent: orders.filter(order => new Date(order.orderDate) >= thirtyDaysAgo).length,
      pending: orders.filter(order => 
        order.status.toLowerCase().includes('pending') || 
        order.status === 'partially fulfilled'
      ).length,
      highValue: orders.filter(order => parseFloat(order.totalAmount) >= 10000).length,
      completed: orders.filter(order => 
        order.status === 'closed' || 
        order.status === 'fully billed'
      ).length,
      all: orders.length
    };
  };
  
  const viewCounts = getViewCounts();

  return (
    <MobileLayout>
              {/* Header Section */}
              <div className="mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
                    <p className="mt-1 text-gray-600">
                      Track and manage your orders
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

              {/* Mobile-friendly view selector */}
              <div className="mb-6 block sm:hidden">
                <Select value={activeView} onValueChange={setActiveView}>
                  <SelectTrigger className="w-full">
                    <div className="flex items-center gap-2">
                      {activeView === 'ready-for-delivery' && <Truck className="h-4 w-4 text-orange-500" />}
                      {activeView === 'recent' && <Calendar className="h-4 w-4 text-blue-500" />}
                      {activeView === 'pending' && <AlertCircle className="h-4 w-4 text-amber-500" />}
                      {activeView === 'high-value' && <DollarSign className="h-4 w-4 text-purple-500" />}
                      {activeView === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {activeView === 'all' && <Package className="h-4 w-4 text-gray-500" />}
                      <span>
                        {activeView === 'ready-for-delivery' && `Ready for Delivery (${viewCounts.readyForDelivery})`}
                        {activeView === 'recent' && `Recent Orders (${viewCounts.recent})`}
                        {activeView === 'pending' && `Pending Orders (${viewCounts.pending})`}
                        {activeView === 'high-value' && `High Value (${viewCounts.highValue})`}
                        {activeView === 'completed' && `Completed (${viewCounts.completed})`}
                        {activeView === 'all' && `All Orders (${viewCounts.all})`}
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ready-for-delivery">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-orange-500" />
                        <span>Ready for Delivery</span>
                        <Badge variant="secondary" className="ml-auto">{viewCounts.readyForDelivery}</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="recent">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-500" />
                        <span>Recent Orders</span>
                        <Badge variant="secondary" className="ml-auto">{viewCounts.recent}</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="pending">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        <span>Pending Orders</span>
                        <Badge variant="secondary" className="ml-auto">{viewCounts.pending}</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="high-value">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-purple-500" />
                        <span>High Value</span>
                        <Badge variant="secondary" className="ml-auto">{viewCounts.highValue}</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="completed">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Completed</span>
                        <Badge variant="secondary" className="ml-auto">{viewCounts.completed}</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-gray-500" />
                        <span>All Orders</span>
                        <Badge variant="secondary" className="ml-auto">{viewCounts.all}</Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Desktop tabs - hidden on mobile */}
              <div className="hidden sm:block mb-6">
                <Tabs value={activeView} onValueChange={setActiveView}>
                  <TabsList className="w-full overflow-x-auto flex justify-start">
                    <TabsTrigger value="ready-for-delivery" className="flex items-center gap-1 min-w-fit px-3 py-2">
                      <Truck className="h-4 w-4 text-orange-500" />
                      <span>Ready for Delivery</span>
                      <Badge variant="secondary" className="ml-1 h-5 px-1">
                        {viewCounts.readyForDelivery}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="recent" className="flex items-center gap-1 min-w-fit px-3 py-2">
                      <Calendar className="h-4 w-4 text-blue-500" />
                      <span>Recent</span>
                      <Badge variant="secondary" className="ml-1 h-5 px-1">
                        {viewCounts.recent}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="flex items-center gap-1 min-w-fit px-3 py-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      <span>Pending</span>
                      <Badge variant="secondary" className="ml-1 h-5 px-1">
                        {viewCounts.pending}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="high-value" className="flex items-center gap-1 min-w-fit px-3 py-2">
                      <DollarSign className="h-4 w-4 text-purple-500" />
                      <span>High Value</span>
                      <Badge variant="secondary" className="ml-1 h-5 px-1">
                        {viewCounts.highValue}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="flex items-center gap-1 min-w-fit px-3 py-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Completed</span>
                      <Badge variant="secondary" className="ml-1 h-5 px-1">
                        {viewCounts.completed}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="all" className="flex items-center gap-1 min-w-fit px-3 py-2">
                      <Package className="h-4 w-4 text-gray-500" />
                      <span>All</span>
                      <Badge variant="secondary" className="ml-1 h-5 px-1">
                        {viewCounts.all}
                      </Badge>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Filters and Search - applies to all views */}
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search by order number..."
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
                          <SelectItem value="pending approval">Pending Approval</SelectItem>
                          <SelectItem value="pending fulfillment">Pending Fulfillment</SelectItem>
                          <SelectItem value="pending billing">Pending Billing</SelectItem>
                          <SelectItem value="partially fulfilled">Partially Fulfilled</SelectItem>
                          <SelectItem value="fully billed">Fully Billed</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
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
                    <p className="text-red-800">Failed to load orders. Please try refreshing the page.</p>
                  </CardContent>
                </Card>
              )}

              {/* Orders List */}
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
                            <Skeleton className="h-5 w-20" />
                            <Skeleton className="h-6 w-16" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-full" />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : filteredOrders.length > 0 ? (
                  filteredOrders.map((order) => (
                    <Card key={order.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {order.orderNumber}
                            </h3>
                            <p className="text-sm text-gray-600">
                              Order Date: {formatDate(order.orderDate)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-gray-900">
                              {formatCurrency(order.totalAmount, order.currency)}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge className={getStatusColor(order.status)}>
                                {getStatusIcon(order.status)}
                                <span className="ml-1 capitalize">{order.status}</span>
                              </Badge>
                              <DataBadge 
                                freshness={order.dataFreshness}
                                lastSync={order.lastSyncAt}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-500">Ship Date:</span>
                            <p className="text-gray-900">{formatDate(order.shipDate)}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-500">Delivery Date:</span>
                            <p className="text-gray-900">{formatDate(order.deliveryDate)}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-500">Tracking Number:</span>
                            <p className="text-gray-900">{order.trackingNumber || 'N/A'}</p>
                          </div>
                          <div className="flex justify-end">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={async () => {
                                // Open modal immediately with basic order info
                                setSelectedOrder(order);
                                setLoadingOrderDetails(true);
                                
                                // Fetch full order details in background
                                try {
                                  const response = await fetch(`/api/orders/${order.id}`, {
                                    headers: {
                                      'Authorization': `Bearer ${token}`
                                    }
                                  });
                                  if (response.ok) {
                                    const orderWithDetails = await response.json();
                                    console.log('Order details fetched:', orderWithDetails);
                                    console.log('Line items count:', orderWithDetails.items?.length || 0);
                                    // Update with complete details
                                    setSelectedOrder(orderWithDetails);
                                  } else {
                                    console.error('Failed to fetch order details, status:', response.status);
                                    const errorText = await response.text();
                                    console.error('Error response:', errorText);
                                  }
                                } catch (error) {
                                  console.error('Failed to fetch order details:', error);
                                } finally {
                                  setLoadingOrderDetails(false);
                                }
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                          </div>
                        </div>

                        {order.shippingAddress && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <span className="font-medium text-gray-500">Shipping Address:</span>
                            <p className="text-sm text-gray-900 mt-1">
                              {JSON.stringify(order.shippingAddress)}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Orders Found</h3>
                        <p className="text-gray-600">
                          {searchTerm || statusFilter !== 'all' 
                            ? 'No orders match your current filters.'
                            : 'You don\'t have any orders yet.'
                          }
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Summary Card */}
              {filteredOrders.length > 0 && (
                <Card className="mt-6">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">Summary</h3>
                        <p className="text-sm text-gray-600">
                          Showing {filteredOrders.length} of {orders?.length || 0} orders
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Total Value</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {formatCurrency(
                            filteredOrders.reduce((sum, order) => sum + parseFloat(order.totalAmount), 0).toString()
                          )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Order Details Modal */}
              <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                      <span>Order Details</span>
                      {selectedOrder && (
                        <Badge className={getStatusColor(selectedOrder.status)}>
                          {getStatusIcon(selectedOrder.status)}
                          <span className="ml-1 capitalize">{selectedOrder.status}</span>
                        </Badge>
                      )}
                    </DialogTitle>
                    <DialogDescription>
                      Order #{selectedOrder?.orderNumber}
                    </DialogDescription>
                  </DialogHeader>
                  
                  {selectedOrder && (
                    <div className="space-y-6 mt-4">
                      {/* Order Summary */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1">Order Date</h3>
                          <p className="text-base flex items-center">
                            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                            {formatDate(selectedOrder.orderDate)}
                          </p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Amount</h3>
                          <p className="text-lg font-semibold">
                            {formatCurrency(selectedOrder.totalAmount, selectedOrder.currency)}
                          </p>
                        </div>
                      </div>

                      <Separator />

                      {/* Shipping Information */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center">
                          <Truck className="h-5 w-5 mr-2" />
                          Shipping Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 mb-1">Ship Date</h4>
                            <p className="text-base">{formatDate(selectedOrder.shipDate)}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 mb-1">Expected Delivery</h4>
                            <p className="text-base">{formatDate(selectedOrder.deliveryDate)}</p>
                          </div>
                          {selectedOrder.trackingNumber && (
                            <div className="md:col-span-2">
                              <h4 className="text-sm font-medium text-gray-500 mb-1">Tracking Number</h4>
                              <p className="text-base font-mono bg-gray-50 p-2 rounded">
                                {selectedOrder.trackingNumber}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Order Items */}
                      {loadingOrderDetails ? (
                        <>
                          <Separator />
                          <div className="space-y-3">
                            <h3 className="text-lg font-semibold flex items-center">
                              <ShoppingCart className="h-5 w-5 mr-2" />
                              Order Items
                            </h3>
                            <div className="animate-pulse space-y-2">
                              <div className="h-12 bg-gray-200 rounded"></div>
                              <div className="h-12 bg-gray-200 rounded"></div>
                              <div className="h-12 bg-gray-200 rounded"></div>
                            </div>
                          </div>
                        </>
                      ) : selectedOrder.items && selectedOrder.items.length > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-3">
                            <h3 className="text-lg font-semibold flex items-center">
                              <ShoppingCart className="h-5 w-5 mr-2" />
                              Order Items
                            </h3>
                            <div className="space-y-2">
                              {(() => {
                                const allItems = selectedOrder.items || [];
                                
                                // Filter out tax items and items with zero amounts
                                const displayItems = allItems.filter(item => {
                                  const itemName = item.itemName || '';
                                  const itemNameLower = itemName.toLowerCase();
                                  const amount = parseFloat(item.amount || 0);
                                  
                                  // Exclude tax items and zero amounts
                                  const isTaxItem = itemName.includes('NY_') || 
                                                   itemNameLower.includes('ny_suffolk') ||
                                                   itemNameLower.includes('ny_bhdl') ||
                                                   itemNameLower.includes('ny_ny') ||
                                                   (itemNameLower.includes('tax') && !itemNameLower.includes('we pay the tax'));
                                  
                                  return Math.abs(amount) > 0.01 && !isTaxItem;
                                });
                                
                                // Calculate totals for summary section
                                let productsTotal = 0;
                                let shippingTotal = 0;
                                let customerDiscountTotal = 0;
                                let promotionalTotal = 0;
                                
                                displayItems.forEach(item => {
                                  const qty = Math.abs(parseFloat(item.quantity || 0));
                                  const rate = Math.abs(parseFloat(item.rate || 0));
                                  const amount = parseFloat(item.amount || 0);
                                  const itemNameLower = (item.itemName || '').toLowerCase();
                                  
                                  const itemTotal = qty > 0 ? qty * rate : Math.abs(amount);
                                  
                                  if (itemNameLower === 'customer discount') {
                                    customerDiscountTotal = itemTotal;
                                  } else if (itemNameLower.includes('delivered') || itemNameLower.includes('ups') || itemNameLower.includes('shipping')) {
                                    shippingTotal += itemTotal;
                                  } else if (itemNameLower.includes('credit') || itemNameLower.includes('we pay the tax') || itemNameLower.includes('we pay')) {
                                    promotionalTotal += itemTotal;
                                  } else if (itemNameLower.includes('% discount') || (itemNameLower === 'discount')) {
                                    // Percentage discounts reduce the products total
                                    productsTotal -= itemTotal;
                                  } else {
                                    // Regular products
                                    productsTotal += itemTotal;
                                  }
                                });
                                
                                // Subtotal includes products minus promotional adjustments (green items)
                                const subtotal = productsTotal - promotionalTotal;
                                
                                return (
                                  <>
                                    {/* Display all items in original NetSuite order */}
                                    {displayItems.map((item, index) => {
                                      const quantity = parseFloat(item.quantity || 0);
                                      const rate = parseFloat(item.rate || 0);
                                      const amount = parseFloat(item.amount || 0);
                                      const itemNameLower = (item.itemName || '').toLowerCase();
                                      
                                      const displayQuantity = Math.abs(quantity);
                                      const displayRate = Math.abs(rate);
                                      
                                      // Calculate display amount
                                      let displayAmount = displayQuantity > 0 
                                        ? displayQuantity * displayRate 
                                        : Math.abs(amount);
                                      
                                      // Determine item type and styling
                                      let bgColor = "bg-gray-50";
                                      let textColor = "text-gray-900";
                                      let descColor = "text-gray-600";
                                      let isNegative = false;
                                      
                                      if (itemNameLower === 'customer discount') {
                                        // Customer Discount - Yellow
                                        bgColor = "bg-yellow-50";
                                        textColor = "text-yellow-900";
                                        descColor = "text-yellow-700";
                                        isNegative = true;
                                      } else if (itemNameLower.includes('delivered') || itemNameLower.includes('ups') || itemNameLower.includes('shipping')) {
                                        // Shipping - Blue
                                        bgColor = "bg-blue-50";
                                        textColor = "text-blue-900";
                                        descColor = "text-blue-700";
                                      } else if (itemNameLower.includes('credit') || itemNameLower.includes('we pay the tax') || itemNameLower.includes('we pay')) {
                                        // Promotional credits - Green
                                        bgColor = "bg-green-50";
                                        textColor = "text-green-900";
                                        descColor = "text-green-700";
                                        isNegative = true;
                                      } else if (itemNameLower.includes('% discount') || (itemNameLower === 'discount')) {
                                        // Percentage discounts - Green
                                        bgColor = "bg-green-50";
                                        textColor = "text-green-900";
                                        descColor = "text-green-700";
                                        isNegative = amount > 0; // Show as negative if positive in NetSuite
                                      }
                                      // Everything else is a regular product (gray)
                                      
                                      return (
                                        <div key={`item-${item.id || index}`} className={`${bgColor} p-3 rounded-lg`}>
                                          <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                              <h4 className={`font-medium ${textColor}`}>
                                                {item.itemName}
                                              </h4>
                                              {item.description && (
                                                <p className={`text-sm ${descColor} mt-1`}>{item.description}</p>
                                              )}
                                            </div>
                                            <div className="text-right ml-4">
                                              <p className={`font-semibold ${textColor}`}>
                                                {isNegative ? '-' : ''}${displayAmount.toFixed(2)}
                                              </p>
                                              {displayQuantity > 0 && (
                                                <p className={`text-sm ${descColor}`}>
                                                  {displayQuantity} × ${displayRate.toFixed(2)}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    
                                    {/* Order Summary */}
                                    <div className="mt-4 pt-4 border-t-2 border-gray-300 space-y-2 bg-gray-50 p-4 rounded-lg">
                                      <h4 className="font-semibold text-gray-900 mb-2">Summary</h4>
                                      
                                      {/* SUBTOTAL - Products plus promotional adjustments */}
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">SUBTOTAL</span>
                                        <span className="font-medium">${subtotal.toFixed(2)}</span>
                                      </div>
                                      
                                      {/* DISCOUNT - Customer Discount only */}
                                      {customerDiscountTotal > 0 && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-gray-600">DISCOUNT</span>
                                          <span className="font-medium">-${customerDiscountTotal.toFixed(2)}</span>
                                        </div>
                                      )}
                                      
                                      {/* TAX */}
                                      {selectedOrder.tax && parseFloat(selectedOrder.tax) > 0 && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-gray-600">TAX</span>
                                          <span className="font-medium">${parseFloat(selectedOrder.tax).toFixed(2)}</span>
                                        </div>
                                      )}
                                      
                                      {/* SHIPPING CHARGES */}
                                      {shippingTotal > 0 && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-gray-600">SHIPPING CHARGES</span>
                                          <span className="font-medium">${shippingTotal.toFixed(2)}</span>
                                        </div>
                                      )}
                                      
                                      {/* TOTAL */}
                                      <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-300">
                                        <span>TOTAL</span>
                                        <span>${parseFloat(selectedOrder.totalAmount).toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Shipping Address */}
                      {selectedOrder.shippingAddress && (
                        <>
                          <Separator />
                          <div className="space-y-3">
                            <h3 className="text-lg font-semibold flex items-center">
                              <MapPin className="h-5 w-5 mr-2" />
                              Shipping Address
                            </h3>
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <p className="text-base">
                                {typeof selectedOrder.shippingAddress === 'object' 
                                  ? Object.entries(selectedOrder.shippingAddress)
                                      .filter(([key, value]) => value)
                                      .map(([key, value]) => (
                                        <span key={key} className="block">
                                          {key === 'addressee' ? <strong>{String(value)}</strong> : String(value)}
                                        </span>
                                      ))
                                  : String(selectedOrder.shippingAddress)
                                }
                              </p>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Action Buttons */}
                      <div className="flex justify-end space-x-3 pt-4">
                        <Button 
                          variant="outline" 
                          onClick={() => setSelectedOrder(null)}
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
