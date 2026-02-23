import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useSync } from "@/contexts/sync-context";
import { useLocation } from "wouter";
import { MobileLayout } from "@/components/layout/mobile-layout";
import { cn } from "@/lib/utils";
import { DataBadge } from "@/components/data-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { OrderDetailModal, Order } from "@/components/order-detail-modal";
import { 
  Search, 
  RefreshCw, 
  Package,
  Clock,
  CheckCircle,
  XCircle,
  CreditCard,
  Truck,
} from "lucide-react";
import { useState, useEffect } from "react";

export default function Orders() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const { triggerLiveSync } = useSync();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [activeView, setActiveView] = useState("active");

  const { data: orders, isLoading, error, refetch } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
    enabled: !!token,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openId = params.get('open');
    if (openId && orders && orders.length > 0 && !selectedOrder) {
      const order = orders.find((o) => o.id === openId);
      if (order) {
        setSelectedOrder(order);
        setLoadingOrderDetails(true);
        fetch(`/api/orders/${order.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => { if (data) setSelectedOrder(data); })
          .catch(() => {})
          .finally(() => setLoadingOrderDetails(false));
        window.history.replaceState({}, '', '/orders');
      }
    }
  }, [orders, token]);

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

  const getFilteredOrdersByView = (viewType: string) => {
    if (!orders) return [];
    
    let viewFiltered = [...orders];
    
    if (searchTerm) {
      return viewFiltered.filter(order => {
        const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (order.memo && order.memo.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (order.tagFor && order.tagFor.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
        return matchesSearch && matchesStatus;
      });
    }
    
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
    
    return viewFiltered.filter(order => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesStatus;
    });
  };
  
  const filteredOrders = getFilteredOrdersByView(activeView);

  const toTitleCase = (str: string) => {
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  if (!user) {
    return <div>Please log in to view your orders</div>;
  }

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

  const handleOrderClick = async (order: Order) => {
    setSelectedOrder(order);
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
  };

  return (
    <MobileLayout>
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

              <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
                <div className="inline-flex items-center rounded-lg bg-gray-100 p-1 w-full md:flex-1">
                  {[
                    { value: 'active', label: 'Active', count: viewCounts.active, activeBg: 'bg-blue-50', activeText: 'text-blue-700', activeBadgeBg: 'bg-blue-100', activeBadgeText: 'text-blue-700', activeBorder: 'ring-blue-200' },
                    { value: 'ready-for-delivery', label: 'Ready', count: viewCounts.readyForDelivery, activeBg: 'bg-orange-50', activeText: 'text-orange-700', activeBadgeBg: 'bg-orange-100', activeBadgeText: 'text-orange-700', activeBorder: 'ring-orange-200' },
                    { value: 'completed', label: 'Completed', count: viewCounts.completed, activeBg: 'bg-green-50', activeText: 'text-green-700', activeBadgeBg: 'bg-green-100', activeBadgeText: 'text-green-700', activeBorder: 'ring-green-200' },
                    { value: 'all', label: 'All', count: viewCounts.all, activeBg: 'bg-gray-50', activeText: 'text-gray-700', activeBadgeBg: 'bg-gray-200', activeBadgeText: 'text-gray-700', activeBorder: 'ring-gray-200' },
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => setActiveView(filter.value)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all",
                        activeView === filter.value
                          ? `${filter.activeBg} ${filter.activeText} shadow-sm ring-1 ${filter.activeBorder}`
                          : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      <span className="truncate">{filter.label}</span>
                      <span className={cn(
                        "text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0",
                        activeView === filter.value
                          ? `${filter.activeBadgeBg} ${filter.activeBadgeText}`
                          : "bg-gray-200 text-gray-500"
                      )}>
                        {filter.count}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="w-full md:w-80">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by SO number, Name or Job ID"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-12 text-base sm:text-sm sm:h-10"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <Card className="mb-6 border-red-200 bg-red-50">
                  <CardContent className="pt-6">
                    <p className="text-red-800">Failed to load orders. Please try refreshing the page.</p>
                  </CardContent>
                </Card>
              )}

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
                                onClick={() => handleOrderClick(order)}
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

                  <div className="md:hidden space-y-3">
                    {filteredOrders.map((order) => (
                      <Card 
                        key={order.id} 
                        className="cursor-pointer active:bg-gray-50 transition-colors"
                        onClick={() => handleOrderClick(order)}
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

              <OrderDetailModal
                order={selectedOrder}
                onClose={() => setSelectedOrder(null)}
                loadingOrderDetails={loadingOrderDetails}
              />
    </MobileLayout>
  );
}
