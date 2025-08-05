import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useSync } from "@/contexts/sync-context";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { DataBadge } from "@/components/data-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { 
  ArrowLeft,
  RefreshCw, 
  Truck,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  MapPin,
  Calendar,
  DollarSign
} from "lucide-react";
import { useState } from "react";

interface OrderItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  sku?: string;
}

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
  billingAddress?: any;
  trackingNumber: string | null;
  dataFreshness: 'live' | 'cached';
  lastSyncAt: string;
  items?: OrderItem[];
  notes?: string;
  customerPO?: string;
  shippingMethod?: string;
  paymentMethod?: string;
  subtotal?: string;
  taxAmount?: string;
  shippingCost?: string;
}

export default function OrderDetails() {
  const { user, token } = useAuth();
  const { triggerLiveSync } = useSync();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Extract order ID from URL path
  const orderId = location.split('/').pop();

  const { data: order, isLoading, error, refetch } = useQuery<Order>({
    queryKey: ['/api/orders', orderId],
    enabled: !!token && !!orderId,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await triggerLiveSync('orders');
      await refetch();
      toast({
        title: "Order Updated",
        description: "Order details have been refreshed with the latest information.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Unable to refresh order details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, JSX.Element> = {
      pending: <Clock className="h-5 w-5" />,
      processing: <Package className="h-5 w-5" />,
      shipped: <Truck className="h-5 w-5" />,
      delivered: <CheckCircle className="h-5 w-5" />,
      cancelled: <XCircle className="h-5 w-5" />,
    };
    return icons[status] || <Clock className="h-5 w-5" />;
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
      month: 'long',
      day: 'numeric',
    });
  };

  const formatAddress = (address: any) => {
    if (!address) return 'N/A';
    if (typeof address === 'string') return address;
    
    // Handle structured address object
    const parts = [];
    if (address.name) parts.push(address.name);
    if (address.company) parts.push(address.company);
    if (address.line1) parts.push(address.line1);
    if (address.line2) parts.push(address.line2);
    if (address.city || address.state || address.zip) {
      const cityStateZip = [address.city, address.state, address.zip].filter(Boolean).join(', ');
      parts.push(cityStateZip);
    }
    if (address.country) parts.push(address.country);
    
    return parts.length > 0 ? parts.join('\n') : JSON.stringify(address, null, 2);
  };

  if (!user) {
    return <div>Please log in to view order details</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="py-6">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="pt-6">
                    <p className="text-red-800">Failed to load order details. Please try again.</p>
                    <Button onClick={() => navigate('/orders')} className="mt-4">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Orders
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
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
                  <div className="flex items-center space-x-4">
                    <Button 
                      variant="outline" 
                      onClick={() => navigate('/orders')}
                      className="flex items-center"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Orders
                    </Button>
                    <div>
                      {isLoading ? (
                        <Skeleton className="h-8 w-48" />
                      ) : (
                        <h1 className="text-2xl font-bold text-gray-900">
                          Order {order?.orderNumber}
                        </h1>
                      )}
                      <p className="mt-1 text-gray-600">
                        Complete order details and tracking information.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {order && <DataBadge freshness={order.dataFreshness} />}
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

              {isLoading ? (
                <div className="space-y-6">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <Skeleton className="h-64" />
                    </CardContent>
                  </Card>
                </div>
              ) : order ? (
                <div className="space-y-6">
                  {/* Order Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center text-lg">
                          <Package className="h-5 w-5 mr-2" />
                          Order Status
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Badge className={`${getStatusColor(order.status)} text-sm px-3 py-2`}>
                          {getStatusIcon(order.status)}
                          <span className="ml-2 capitalize">{order.status}</span>
                        </Badge>
                        <p className="text-sm text-gray-600 mt-2">
                          Last updated: {new Date(order.lastSyncAt).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center text-lg">
                          <DollarSign className="h-5 w-5 mr-2" />
                          Order Total
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(order.totalAmount, order.currency)}
                        </p>
                        {order.subtotal && (
                          <div className="text-sm text-gray-600 mt-2 space-y-1">
                            <div className="flex justify-between">
                              <span>Subtotal:</span>
                              <span>{formatCurrency(order.subtotal, order.currency)}</span>
                            </div>
                            {order.taxAmount && (
                              <div className="flex justify-between">
                                <span>Tax:</span>
                                <span>{formatCurrency(order.taxAmount, order.currency)}</span>
                              </div>
                            )}
                            {order.shippingCost && (
                              <div className="flex justify-between">
                                <span>Shipping:</span>
                                <span>{formatCurrency(order.shippingCost, order.currency)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center text-lg">
                          <Calendar className="h-5 w-5 mr-2" />
                          Important Dates
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <span className="text-sm font-medium text-gray-500">Order Date:</span>
                          <p className="text-sm text-gray-900">{formatDate(order.orderDate)}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500">Ship Date:</span>
                          <p className="text-sm text-gray-900">{formatDate(order.shipDate)}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500">Delivery Date:</span>
                          <p className="text-sm text-gray-900">{formatDate(order.deliveryDate)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Tracking Information */}
                  {order.trackingNumber && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Truck className="h-5 w-5 mr-2" />
                          Tracking Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-sm font-medium text-blue-900">Tracking Number</label>
                              <p className="text-lg font-mono text-blue-800">{order.trackingNumber}</p>
                              {order.shippingMethod && (
                                <p className="text-sm text-blue-700 mt-1">via {order.shippingMethod}</p>
                              )}
                            </div>
                            <Button variant="outline" size="sm">
                              Track Package
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Order Items */}
                  {order.items && order.items.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Order Items</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left py-3 px-2 font-medium text-gray-700">Item</th>
                                <th className="text-left py-3 px-2 font-medium text-gray-700">SKU</th>
                                <th className="text-center py-3 px-2 font-medium text-gray-700">Quantity</th>
                                <th className="text-right py-3 px-2 font-medium text-gray-700">Unit Price</th>
                                <th className="text-right py-3 px-2 font-medium text-gray-700">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.items.map((item, index) => (
                                <tr key={item.id || index} className="border-b border-gray-100">
                                  <td className="py-4 px-2">
                                    <div>
                                      <p className="font-medium text-gray-900">{item.name}</p>
                                      {item.description && (
                                        <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-4 px-2 text-sm text-gray-600 font-mono">
                                    {item.sku || 'N/A'}
                                  </td>
                                  <td className="py-4 px-2 text-center text-gray-900">
                                    {item.quantity}
                                  </td>
                                  <td className="py-4 px-2 text-right text-gray-900">
                                    {formatCurrency(item.unitPrice, order.currency)}
                                  </td>
                                  <td className="py-4 px-2 text-right font-medium text-gray-900">
                                    {formatCurrency(item.totalPrice, order.currency)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Addresses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {order.shippingAddress && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center">
                            <MapPin className="h-5 w-5 mr-2" />
                            Shipping Address
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                            {formatAddress(order.shippingAddress)}
                          </pre>
                        </CardContent>
                      </Card>
                    )}

                    {order.billingAddress && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center">
                            <DollarSign className="h-5 w-5 mr-2" />
                            Billing Address
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                            {formatAddress(order.billingAddress)}
                          </pre>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Additional Information */}
                  {(order.notes || order.customerPO || order.paymentMethod) && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Additional Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {order.customerPO && (
                          <div>
                            <label className="text-sm font-medium text-gray-500">Customer PO Number</label>
                            <p className="text-gray-900">{order.customerPO}</p>
                          </div>
                        )}
                        {order.paymentMethod && (
                          <div>
                            <label className="text-sm font-medium text-gray-500">Payment Method</label>
                            <p className="text-gray-900">{order.paymentMethod}</p>
                          </div>
                        )}
                        {order.notes && (
                          <div>
                            <label className="text-sm font-medium text-gray-500">Order Notes</label>
                            <p className="text-gray-900 whitespace-pre-wrap">{order.notes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Order Not Found</h3>
                      <p className="text-gray-600 mb-4">
                        The order you're looking for doesn't exist or you don't have permission to view it.
                      </p>
                      <Button onClick={() => navigate('/orders')}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Orders
                      </Button>
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