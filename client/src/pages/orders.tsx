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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  XCircle
} from "lucide-react";
import { useState } from "react";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: string;
  shipDate: string | null;
  deliveryDate: string | null;
  totalAmount: string;
  currency: string;
  shippingAddress: any;
  trackingNumber: string | null;
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
      pending: <Clock className="h-4 w-4" />,
      processing: <Package className="h-4 w-4" />,
      shipped: <Truck className="h-4 w-4" />,
      delivered: <CheckCircle className="h-4 w-4" />,
      cancelled: <XCircle className="h-4 w-4" />,
    };
    return icons[status] || <Clock className="h-4 w-4" />;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      shipped: 'bg-blue-100 text-blue-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
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

  const filteredOrders = orders?.filter(order => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  if (!user) {
    return <div>Please log in to view your orders</div>;
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
                    <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
                    <p className="mt-1 text-gray-600">
                      Track and manage your orders with real-time updates from NetSuite.
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

              {/* Filters and Search */}
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
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="shipped">Shipped</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
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
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Order Details - {order.orderNumber}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-6">
                                  {/* Order Summary */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                      <div>
                                        <label className="text-sm font-medium text-gray-500">Order Number</label>
                                        <p className="text-lg font-semibold text-gray-900">{order.orderNumber}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-500">Status</label>
                                        <div className="mt-1">
                                          <Badge className={getStatusColor(order.status)}>
                                            {getStatusIcon(order.status)}
                                            <span className="ml-1 capitalize">{order.status}</span>
                                          </Badge>
                                        </div>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-500">Total Amount</label>
                                        <p className="text-xl font-bold text-gray-900">
                                          {formatCurrency(order.totalAmount, order.currency)}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="space-y-3">
                                      <div>
                                        <label className="text-sm font-medium text-gray-500">Order Date</label>
                                        <p className="text-gray-900">{formatDate(order.orderDate)}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-500">Ship Date</label>
                                        <p className="text-gray-900">{formatDate(order.shipDate)}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-500">Delivery Date</label>
                                        <p className="text-gray-900">{formatDate(order.deliveryDate)}</p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Tracking Information */}
                                  {order.trackingNumber && (
                                    <div className="border-t pt-4">
                                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Tracking Information</h3>
                                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <div className="flex items-center">
                                          <Truck className="h-5 w-5 text-blue-600 mr-2" />
                                          <div>
                                            <label className="text-sm font-medium text-blue-900">Tracking Number</label>
                                            <p className="text-blue-800 font-mono">{order.trackingNumber}</p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Shipping Address */}
                                  {order.shippingAddress && (
                                    <div className="border-t pt-4">
                                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Shipping Address</h3>
                                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                        <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                                          {typeof order.shippingAddress === 'string' 
                                            ? order.shippingAddress 
                                            : JSON.stringify(order.shippingAddress, null, 2)}
                                        </pre>
                                      </div>
                                    </div>
                                  )}

                                  {/* Data Freshness */}
                                  <div className="border-t pt-4">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Data Information</h3>
                                    <div className="flex items-center space-x-4">
                                      <DataBadge 
                                        freshness={order.dataFreshness}
                                        lastSync={order.lastSyncAt}
                                      />
                                      <p className="text-sm text-gray-600">
                                        Last updated: {new Date(order.lastSyncAt).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
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
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
