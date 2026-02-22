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
import { apiRequest } from "@/lib/queryClient";

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
  memo?: string;
  tagFor?: string;
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
  const [activeView, setActiveView] = useState("active");
  const [cabinetBuildDetails, setCabinetBuildDetails] = useState<any>({});
  const [visibleBuildDetails, setVisibleBuildDetails] = useState<Record<string, boolean>>({});
  const [loadingCabinetBuild, setLoadingCabinetBuild] = useState<string | null>(null);

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

  const fetchCabinetBuildDetails = async (buildId: string, itemName: string) => {
    setLoadingCabinetBuild(itemName);
    try {
      const response = await apiRequest('GET', `/api/cabinet-build/${buildId}`);
      const data = await response.json();
      setCabinetBuildDetails(prev => ({
        ...prev,
        [itemName]: data
      }));
    } catch (error) {
      console.error('Failed to fetch cabinet build details:', error);
      toast({
        title: "Failed to load details",
        description: "Unable to fetch cabinet build details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingCabinetBuild(null);
    }
  };
  
  const fetchCounterBuildDetails = async (buildId: string, itemName: string) => {
    setLoadingCabinetBuild(itemName);
    try {
      const response = await apiRequest('GET', `/api/counter-build/${buildId}`);
      const data = await response.json();
      setCabinetBuildDetails(prev => ({
        ...prev,
        [itemName]: data
      }));
    } catch (error) {
      console.error('Failed to fetch counter build details:', error);
      toast({
        title: "Failed to load details",
        description: "Unable to fetch counter build details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingCabinetBuild(null);
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
      case 'active':
        viewFiltered = viewFiltered.filter(order => 
          order.status !== 'closed' && 
          order.status !== 'fully billed' &&
          order.status !== 'cancelled'
        );
        break;

      case 'ready-for-delivery':
        viewFiltered = viewFiltered.filter(order => 
          order.status === 'partially fulfilled' || 
          order.status === 'pending billing'
        );
        break;
        
      case 'completed':
        viewFiltered = viewFiltered.filter(order => 
          order.status === 'closed' || 
          order.status === 'fully billed'
        );
        break;
      
      case 'all':
      default:
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

  const toTitleCase = (str: string) => {
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  if (!user) {
    return <div>Please log in to view your orders</div>;
  }

  // Get counts for each view
  const getViewCounts = () => {
    if (!orders) return { active: 0, readyForDelivery: 0, completed: 0, all: 0 };
    
    return {
      active: orders.filter(order => 
        order.status !== 'closed' && 
        order.status !== 'fully billed' &&
        order.status !== 'cancelled'
      ).length,
      readyForDelivery: orders.filter(order => 
        order.status === 'partially fulfilled' || 
        order.status === 'pending billing'
      ).length,
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
                      {activeView === 'active' && <Package className="h-4 w-4 text-blue-500" />}
                      {activeView === 'ready-for-delivery' && <Truck className="h-4 w-4 text-orange-500" />}
                      {activeView === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {activeView === 'all' && <Package className="h-4 w-4 text-gray-500" />}
                      <span>
                        {activeView === 'active' && `Active (${viewCounts.active})`}
                        {activeView === 'ready-for-delivery' && `Ready for Delivery (${viewCounts.readyForDelivery})`}
                        {activeView === 'completed' && `Completed (${viewCounts.completed})`}
                        {activeView === 'all' && `All Orders (${viewCounts.all})`}
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-blue-500" />
                        <span>Active</span>
                        <Badge variant="secondary" className="ml-auto">{viewCounts.active}</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="ready-for-delivery">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-orange-500" />
                        <span>Ready for Delivery</span>
                        <Badge variant="secondary" className="ml-auto">{viewCounts.readyForDelivery}</Badge>
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
                    <TabsTrigger value="active" className="flex items-center gap-1 min-w-fit px-3 py-2">
                      <Package className="h-4 w-4 text-blue-500" />
                      <span>Active</span>
                      <Badge variant="secondary" className="ml-1 h-5 px-1">
                        {viewCounts.active}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="ready-for-delivery" className="flex items-center gap-1 min-w-fit px-3 py-2">
                      <Truck className="h-4 w-4 text-orange-500" />
                      <span>Ready for Delivery</span>
                      <Badge variant="secondary" className="ml-1 h-5 px-1">
                        {viewCounts.readyForDelivery}
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

              {/* Filters and Search - Mobile optimized */}
              <Card className="mb-4 sm:mb-6">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col gap-3">
                    <div className="w-full">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search orders..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 h-12 text-base sm:text-sm sm:h-10"
                        />
                      </div>
                    </div>
                    <div className="w-full">
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-12 sm:h-10">
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
              {isLoading ? (
                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 py-3">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-32 flex-1" />
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-6 w-16" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : filteredOrders.length > 0 ? (
                <>
                  {/* Desktop table - hidden on mobile */}
                  <Card className="hidden md:block">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Order #</th>
                              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">CRD End User</th>
                              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Job ID</th>
                              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Date</th>
                              <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Amount</th>
                              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {filteredOrders.map((order) => (
                              <tr 
                                key={order.id} 
                                className="hover:bg-gray-50 transition-colors cursor-pointer"
                                onClick={async () => {
                                  setSelectedOrder(order);
                                  setLoadingOrderDetails(true);
                                  setCabinetBuildDetails({});
                                  setVisibleBuildDetails({});
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
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.orderNumber}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.tagFor ? toTitleCase(order.tagFor) : '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.memo ? toTitleCase(order.memo) : '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(order.orderDate)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">{formatCurrency(order.totalAmount, order.currency)}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <Badge className={`${getStatusColor(order.status)} px-2 py-0.5`}>
                                    <span className="capitalize text-xs">{order.status}</span>
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Mobile cards - hidden on desktop */}
                  <div className="md:hidden space-y-3">
                    {filteredOrders.map((order) => (
                      <Card 
                        key={order.id} 
                        className="cursor-pointer active:bg-gray-50 transition-colors"
                        onClick={async () => {
                          setSelectedOrder(order);
                          setLoadingOrderDetails(true);
                          setCabinetBuildDetails({});
                          setVisibleBuildDetails({});
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
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{order.orderNumber}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{formatDate(order.orderDate)}</p>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">{formatCurrency(order.totalAmount, order.currency)}</p>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-700 space-y-1">
                              {order.tagFor && <p className="font-medium"><span className="text-gray-400 text-xs">End User:</span> {toTitleCase(order.tagFor)}</p>}
                              {order.memo && <p className="font-medium"><span className="text-gray-400 text-xs">Job ID:</span> {toTitleCase(order.memo)}</p>}
                            </div>
                            <Badge className={`${getStatusColor(order.status)} px-2 py-0.5`}>
                              <span className="capitalize text-xs">{order.status}</span>
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              ) : (
                <Card>
                  <CardContent className="p-4 sm:p-6">
                    <div className="text-center py-6 sm:py-8">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No Orders Found</h3>
                      <p className="text-sm sm:text-base text-gray-600">
                        {searchTerm || statusFilter !== 'all' 
                          ? 'No orders match your current filters.'
                          : 'You don\'t have any orders yet.'
                        }
                      </p>
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
                        {selectedOrder.memo && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-500 mb-1">Job ID</h3>
                            <p className="text-base">{selectedOrder.memo}</p>
                          </div>
                        )}
                        {selectedOrder.tagFor && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-500 mb-1">CRD END USER</h3>
                            <p className="text-base">{selectedOrder.tagFor}</p>
                          </div>
                        )}
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
                                              {item.description && 
                                                !item.description.toLowerCase().includes('click print for description') && (
                                                <p className={`text-sm ${descColor} mt-1`}>{item.description}</p>
                                              )}
                                              {/* Show additional details for Customer Discount */}
                                              {itemNameLower === 'customer discount' && (
                                                <div className={`text-xs ${descColor} mt-2`}>
                                                  {item.discountPercent && (
                                                    <p>Discount Rate: {item.discountPercent}%</p>
                                                  )}
                                                  {item.itemDescription && (
                                                    <p>Details: {item.itemDescription}</p>
                                                  )}
                                                </div>
                                              )}
                                              {/* Add View Details button for SPCAB items */}
                                              {itemNameLower.includes('spcab') && (
                                                <div className="mt-2">
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                      // Check if details are visible
                                                      if (visibleBuildDetails[item.itemName]) {
                                                        // Just hide the details, keep data cached
                                                        setVisibleBuildDetails(prev => ({
                                                          ...prev,
                                                          [item.itemName]: false
                                                        }));
                                                      } else {
                                                        // Show details if already cached, otherwise fetch
                                                        if (cabinetBuildDetails[item.itemName]) {
                                                          // Data is cached, just show it
                                                          setVisibleBuildDetails(prev => ({
                                                            ...prev,
                                                            [item.itemName]: true
                                                          }));
                                                        } else {
                                                          // Need to fetch data
                                                          const buildIdOrOrderNum = item.cabBuildId || selectedOrder.orderNumber;
                                                          fetchCabinetBuildDetails(buildIdOrOrderNum, item.itemName);
                                                          setVisibleBuildDetails(prev => ({
                                                            ...prev,
                                                            [item.itemName]: true
                                                          }));
                                                        }
                                                      }
                                                    }}
                                                    disabled={loadingCabinetBuild === item.itemName}
                                                  >
                                                    {loadingCabinetBuild === item.itemName ? 'Loading...' : 
                                                     visibleBuildDetails[item.itemName] ? 'Hide Details' : 'View Details'}
                                                  </Button>
                                                  
                                                  {/* Display Cabinet Build Details */}
                                                  {visibleBuildDetails[item.itemName] && cabinetBuildDetails[item.itemName] && (
                                                    <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg">
                                                      <h5 className="font-semibold text-sm mb-2">Cabinet Build Details</h5>
                                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div>
                                                          <span className="text-gray-500">Build ID:</span>
                                                          <p className="font-medium">{cabinetBuildDetails[item.itemName].cabbuildid || ''}</p>
                                                        </div>
                                                        <div>
                                                          <span className="text-gray-500">Product Line:</span>
                                                          <p className="font-medium">{cabinetBuildDetails[item.itemName].prodline || ''}</p>
                                                        </div>
                                                        <div>
                                                          <span className="text-gray-500">Material:</span>
                                                          <p className="font-medium">{cabinetBuildDetails[item.itemName].material || ''}</p>
                                                        </div>
                                                        <div>
                                                          <span className="text-gray-500">Upper Door Style:</span>
                                                          <p className="font-medium">{cabinetBuildDetails[item.itemName].upperdoorstyle || ''}</p>
                                                        </div>
                                                        <div>
                                                          <span className="text-gray-500">Lower Door Style:</span>
                                                          <p className="font-medium">{cabinetBuildDetails[item.itemName].lowerdoorstyle || ''}</p>
                                                        </div>
                                                        <div>
                                                          <span className="text-gray-500">Cabinet Construction:</span>
                                                          <p className="font-medium">{cabinetBuildDetails[item.itemName].cabinetconstruction || ''}</p>
                                                        </div>
                                                        <div>
                                                          <span className="text-gray-500">Cabinet Style:</span>
                                                          <p className="font-medium">{cabinetBuildDetails[item.itemName].cabinetstyle || ''}</p>
                                                        </div>
                                                        <div>
                                                          <span className="text-gray-500">Hinge Type:</span>
                                                          <p className="font-medium">{cabinetBuildDetails[item.itemName].hingetype || ''}</p>
                                                        </div>
                                                        <div>
                                                          <span className="text-gray-500">Drawer Construction:</span>
                                                          <p className="font-medium">{cabinetBuildDetails[item.itemName].drawerconstruction || ''}</p>
                                                        </div>
                                                        <div>
                                                          <span className="text-gray-500">Drawer Style:</span>
                                                          <p className="font-medium">{cabinetBuildDetails[item.itemName].drawerstyle || ''}</p>
                                                        </div>
                                                        <div>
                                                          <span className="text-gray-500">Exterior Finish:</span>
                                                          <p className="font-medium">{cabinetBuildDetails[item.itemName].exteriorfinish || ''}</p>
                                                        </div>
                                                        <div>
                                                          <span className="text-gray-500">Treatment:</span>
                                                          <p className="font-medium">{cabinetBuildDetails[item.itemName].treatment || ''}</p>
                                                        </div>
                                                        {cabinetBuildDetails[item.itemName].memo && (
                                                          <div className="col-span-2">
                                                            <span className="text-gray-500">Memo:</span>
                                                            <p className="font-medium">{cabinetBuildDetails[item.itemName].memo}</p>
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                              
                                              {/* Add View Details button for SPCNTR items */}
                                              {itemNameLower.includes('spcntr') && (
                                                <div className="mt-2">
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                      // Check if details are visible
                                                      if (visibleBuildDetails[item.itemName]) {
                                                        // Just hide the details, keep data cached
                                                        setVisibleBuildDetails(prev => ({
                                                          ...prev,
                                                          [item.itemName]: false
                                                        }));
                                                      } else {
                                                        // Show details if already cached, otherwise fetch
                                                        if (cabinetBuildDetails[item.itemName]) {
                                                          // Data is cached, just show it
                                                          setVisibleBuildDetails(prev => ({
                                                            ...prev,
                                                            [item.itemName]: true
                                                          }));
                                                        } else {
                                                          // Need to fetch data
                                                          const buildIdOrOrderNum = item.cntrBuildId || selectedOrder.orderNumber;
                                                          fetchCounterBuildDetails(buildIdOrOrderNum, item.itemName);
                                                          setVisibleBuildDetails(prev => ({
                                                            ...prev,
                                                            [item.itemName]: true
                                                          }));
                                                        }
                                                      }
                                                    }}
                                                    disabled={loadingCabinetBuild === item.itemName}
                                                  >
                                                    {loadingCabinetBuild === item.itemName ? 'Loading...' : 
                                                     visibleBuildDetails[item.itemName] ? 'Hide Details' : 'View Details'}
                                                  </Button>
                                                  
                                                  {/* Display Counter Build Details */}
                                                  {visibleBuildDetails[item.itemName] && cabinetBuildDetails[item.itemName] && (
                                                    <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg">
                                                      <h5 className="font-semibold text-sm mb-2">Counter Build Details</h5>
                                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div>
                                                          <span className="text-gray-500">Build ID:</span>
                                                          <p className="font-medium">{cabinetBuildDetails[item.itemName].cntrBuildId || 'N/A'}</p>
                                                        </div>
                                                        <div>
                                                          <span className="text-gray-500">Material:</span>
                                                          <p className="font-medium">{cabinetBuildDetails[item.itemName].material || 'N/A'}</p>
                                                        </div>
                                                        <div>
                                                          <span className="text-gray-500">Edge:</span>
                                                          <p className="font-medium">{cabinetBuildDetails[item.itemName].edge || 'N/A'}</p>
                                                        </div>
                                                        <div>
                                                          <span className="text-gray-500">Backsplash:</span>
                                                          <p className="font-medium">{cabinetBuildDetails[item.itemName].backsplash || 'N/A'}</p>
                                                        </div>
                                                        <div>
                                                          <span className="text-gray-500">Thickness:</span>
                                                          <p className="font-medium">{cabinetBuildDetails[item.itemName].thickness || 'N/A'}</p>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
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
                                          
                                          {/* Display PRA details if available - moved outside main flex */}
                                          {itemNameLower === 'customer discount' && selectedOrder.praDetails && selectedOrder.praDetails.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-yellow-200">
                                              <div className="space-y-1">
                                                {selectedOrder.praDetails.map((pra: any, praIndex: number) => {
                                                  const discountAmount = Math.abs(parseFloat(pra.discountRate || 0));
                                                  const displayPercent = pra.praCode === '372' ? ' • 5% Off' : '';
                                                  
                                                  return (
                                                    <div key={praIndex} className="flex justify-between items-start pl-2 border-l-2 border-yellow-300">
                                                      <div className="flex-1">
                                                        <p className="font-medium text-yellow-700">
                                                          {pra.praDescription || 'Promotional Adjustment'}
                                                          {displayPercent && <span className="text-xs">{displayPercent}</span>}
                                                        </p>
                                                      </div>
                                                      <div className="text-right ml-4 w-24">
                                                        <p className="text-sm font-medium text-yellow-700">
                                                          ${discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </p>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                              <p className="italic text-xs text-yellow-600 mt-2">This discount includes all promotional adjustments and account-specific pricing.</p>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                    
                                    {/* Order Summary */}
                                    <div className="mt-4 pt-4 border-t-2 border-gray-300 space-y-2 bg-gray-50 p-4 rounded-lg">
                                      <h4 className="font-semibold text-gray-900 mb-2">Summary</h4>
                                      
                                      {/* SUBTOTAL - Products plus promotional adjustments */}
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">SUBTOTAL</span>
                                        <span className="font-medium">${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                      
                                      {/* DISCOUNT - Customer Discount only */}
                                      {customerDiscountTotal > 0 && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-gray-600">DISCOUNT</span>
                                          <span className="font-medium">-${customerDiscountTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                      )}
                                      
                                      {/* TAX */}
                                      {selectedOrder.tax && parseFloat(selectedOrder.tax) > 0 && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-gray-600">TAX</span>
                                          <span className="font-medium">${parseFloat(selectedOrder.tax).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                      )}
                                      
                                      {/* SHIPPING CHARGES */}
                                      {shippingTotal > 0 && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-gray-600">SHIPPING CHARGES</span>
                                          <span className="font-medium">${shippingTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                      )}
                                      
                                      {/* TOTAL */}
                                      <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-300">
                                        <span>TOTAL</span>
                                        <span>${parseFloat(selectedOrder.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                          onClick={() => {
                            setSelectedOrder(null);
                            // Clear cached build details when closing order
                            setCabinetBuildDetails({});
                            setVisibleBuildDetails({});
                          }}
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
