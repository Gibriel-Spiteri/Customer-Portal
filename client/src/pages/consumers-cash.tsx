import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import { MobileLayout } from '@/components/layout/mobile-layout';
import { DataBadge } from '@/components/data-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Coins,
  DollarSign, 
  Calendar, 
  ShoppingCart, 
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  ChevronLeft,
  RefreshCw,
  Award,
  Gift,
  Wallet,
  Download,
  ChevronRight
} from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'wouter';

interface CRDRebate {
  id: string;
  date: string;
  amount: string;
  type: string;
  reversed: boolean;
  salesOrder: string;
  expirationDate: string | null;
  applyingTransaction: string | null;
  category: string | null;
  earnedPercent: string | null;
  salesOrderRebateRate: string | null;
  status: 'Earned' | 'Redeemed' | 'Expired' | 'Return' | 'Accommodation' | 'Unknown';
}

interface CRDRebatesResponse {
  rebates: CRDRebate[];
  summary: {
    totalAvailable: string;
    totalExpired: string;
    totalRedeemed: string;
    totalRebates: number;
  };
}

interface OrderItem {
  id: string;
  lineNumber: number;
  itemName: string;
  quantity: number;
  rate: string;
  amount: string;
  description: string;
}

interface OrderFile {
  fileId: string;
  fileName: string;
  fileDescription: string | null;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  createdDate: string;
  lastModifiedDate: string;
  messageSubject: string | null;
  messageDate: string | null;
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
  discountTotal?: string;
  currency: string;
  shippingAddress: any;
  trackingNumber: string | null;
  memo?: string;
  tagFor?: string;
  items?: OrderItem[];
  files?: OrderFile[];
  dataFreshness: 'live' | 'cached';
  lastSyncAt: string;
}

export default function ConsumersCash() {
  const { user, token } = useAuth();
  const { triggerLiveSync } = useSync();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(25);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);

  const handleSOClick = useCallback(async (soNumber: string) => {
    if (!token) return;
    setLoadingOrderDetails(true);
    try {
      const ordersRes = await fetch('/api/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!ordersRes.ok) throw new Error('Failed to fetch orders');
      const orders: Order[] = await ordersRes.json();
      const match = orders.find(o => o.orderNumber === soNumber);
      if (!match) {
        toast({ title: "Order not found", description: `Could not find order ${soNumber}`, variant: "destructive" });
        setLoadingOrderDetails(false);
        return;
      }
      setSelectedOrder(match);
      const detailRes = await fetch(`/api/orders/${match.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (detailRes.ok) {
        setSelectedOrder(await detailRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch order:', error);
      toast({ title: "Error", description: "Failed to load order details", variant: "destructive" });
    } finally {
      setLoadingOrderDetails(false);
    }
  }, [token, toast]);
  
  const { data, isLoading, error, refetch } = useQuery<CRDRebatesResponse>({
    queryKey: ['/api/crd-rebates'],
    enabled: !!token,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Pagination logic
  const paginatedRebates = useMemo(() => {
    if (!data?.rebates) return [];
    
    if (pageSize === 'all') {
      return data.rebates;
    }
    
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.rebates.slice(startIndex, endIndex);
  }, [data?.rebates, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (!data?.rebates || pageSize === 'all') return 1;
    return Math.ceil(data.rebates.length / pageSize);
  }, [data?.rebates, pageSize]);

  // Reset to page 1 when page size changes
  const handlePageSizeChange = (value: string) => {
    const newSize = value === 'all' ? 'all' : parseInt(value);
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await triggerLiveSync('orders');
      await refetch();
      toast({
        title: "Data Refreshed",
        description: "Your Consumers Cash information has been updated.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Unable to refresh data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const response = await fetch('/api/crd-rebates/download', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consumers_cash_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Complete",
        description: "Your Consumers Cash data has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Unable to download CSV file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num || 0);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Earned':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Redeemed':
        return <DollarSign className="h-4 w-4 text-blue-600" />;
      case 'Expired':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'Return':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'Accommodation':
        return <Gift className="h-4 w-4 text-purple-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Earned':
        return 'bg-green-100 text-green-800';
      case 'Redeemed':
        return 'bg-blue-100 text-blue-800';
      case 'Expired':
        return 'bg-gray-100 text-gray-800';
      case 'Return':
        return 'bg-red-100 text-red-800';
      case 'Accommodation':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!user) {
    return <div>Please log in to view your Consumers Cash</div>;
  }

  return (
    <MobileLayout>
      {/* Header Section */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Consumers Cash</h1>
            <p className="mt-1 text-sm sm:text-base text-gray-600">
              Your CRD rebate rewards and transaction history
            </p>
          </div>
          <div className="flex items-center gap-2 sm:space-x-3">
            <DataBadge freshness="live" />
            <Button
              onClick={handleDownloadCSV}
              variant="outline"
              size="sm"
              disabled={isLoading || !data?.rebates?.length}
            >
              <Download className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Download</span> CSV
            </Button>
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              variant="outline"
              size="sm"
            >
              {isRefreshing ? (
                <RefreshCw className="h-4 w-4 animate-spin sm:mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load Consumers Cash data. Please try refreshing the page.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium">Available Balance</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600 hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold text-green-600">
                  {formatCurrency(data?.summary.totalAvailable || 0)}
                </div>
                <p className="text-xs text-muted-foreground hidden sm:block">Ready to use</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium">Redeemed</CardTitle>
                <DollarSign className="h-4 w-4 text-blue-600 hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold text-blue-600">
                  {formatCurrency(data?.summary.totalRedeemed || 0)}
                </div>
                <p className="text-xs text-muted-foreground hidden sm:block">Already used</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium">Rebate Level</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600 hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold">{data?.summary.customerRebateRate || '10'}%</div>
                <p className="text-xs text-muted-foreground hidden sm:block">Active rate</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium">12-Mo Sales</CardTitle>
                <TrendingUp className="h-4 w-4 text-indigo-600 hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold text-indigo-600">
                  {formatCurrency(data?.summary.qualifyingSales || 0)}
                </div>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {data?.summary.qualifyingSales ? 'Qualifying purchases' : 'No qualifying sales'}
                </p>
              </CardContent>
            </Card>
          </div>

      {/* Rebate History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Rebate History</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Show:</span>
              <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!data?.rebates || data.rebates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Coins className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No rebates found for your account</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedRebates.map((rebate) => (
                <div
                  key={rebate.id}
                  className="p-3 sm:p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(rebate.status)}
                      <span className="font-semibold text-base sm:text-lg">
                        {formatCurrency(rebate.amount)}
                      </span>
                    </div>
                    <Badge className={`${getStatusColor(rebate.status)} shrink-0`}>
                      {rebate.status}
                    </Badge>
                  </div>

                  <div className="text-xs sm:text-sm text-gray-500 space-y-1 pl-7">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(rebate.date)}
                    </div>
                    <div className="flex items-center justify-between">
                      {rebate.salesOrder ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSOClick(rebate.salesOrder); }}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          <ShoppingCart className="h-3 w-3" />
                          {rebate.salesOrder}
                        </button>
                      ) : <span />}
                      {rebate.expirationDate && rebate.status === 'Earned' && (
                        <span className="text-orange-600 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expires: {formatDate(rebate.expirationDate)}
                        </span>
                      )}
                      {rebate.expirationDate && rebate.status === 'Expired' && (
                        <span className="text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expired: {formatDate(rebate.expirationDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination Controls */}
            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-gray-500">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, data?.rebates?.length || 0)} of {data?.rebates?.length || 0} rebates
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={i}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-10"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>
        </>
      )}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-0">
            <DialogTitle className="flex items-center justify-between">
              <span>Order #{selectedOrder?.orderNumber}</span>
              {selectedOrder && (
                <Badge className={
                  selectedOrder.status === 'fully billed' || selectedOrder.status === 'closed' ? 'bg-green-100 text-green-800' :
                  selectedOrder.status === 'pending fulfillment' ? 'bg-blue-100 text-blue-800' :
                  selectedOrder.status === 'pending billing' ? 'bg-purple-100 text-purple-800' :
                  selectedOrder.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }>
                  <span className="capitalize">{selectedOrder.status}</span>
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Details for order #{selectedOrder?.orderNumber}
            </DialogDescription>
          </DialogHeader>

          {loadingOrderDetails && !selectedOrder?.items ? (
            <div className="space-y-4 py-4">
              <div className="animate-pulse space-y-3">
                <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-12 bg-gray-200 rounded"></div>
                <div className="h-12 bg-gray-200 rounded"></div>
              </div>
            </div>
          ) : selectedOrder && (
            <div className="space-y-6">
              {(selectedOrder.memo || selectedOrder.tagFor) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedOrder.tagFor && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">End User</h4>
                      <p className="text-base">{selectedOrder.tagFor}</p>
                    </div>
                  )}
                  {selectedOrder.memo && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Job ID</h4>
                      <p className="text-base">{selectedOrder.memo}</p>
                    </div>
                  )}
                </div>
              )}

              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Order Date</h4>
                  <p className="text-base flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                    {formatDate(selectedOrder.orderDate)}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Total Amount</h4>
                  <p className="text-lg font-semibold">{formatCurrency(selectedOrder.totalAmount)}</p>
                </div>
              </div>

              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center">
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Order Items
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="text-left py-2 px-3 font-medium text-gray-600">Item</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-600">Description</th>
                            <th className="text-right py-2 px-3 font-medium text-gray-600">Qty</th>
                            <th className="text-right py-2 px-3 font-medium text-gray-600">Rate</th>
                            <th className="text-right py-2 px-3 font-medium text-gray-600">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedOrder.items.map((item) => (
                            <tr key={item.id} className="border-b border-gray-100">
                              <td className="py-2 px-3 font-medium">{item.itemName}</td>
                              <td className="py-2 px-3 text-gray-600 max-w-[200px] truncate">{item.description || '-'}</td>
                              <td className="py-2 px-3 text-right">{item.quantity}</td>
                              <td className="py-2 px-3 text-right">{formatCurrency(item.rate)}</td>
                              <td className="py-2 px-3 text-right font-medium">{formatCurrency(item.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          {selectedOrder.tax && parseFloat(selectedOrder.tax) > 0 && (
                            <tr className="border-t border-gray-200">
                              <td colSpan={4} className="py-2 px-3 text-right text-gray-600">Tax</td>
                              <td className="py-2 px-3 text-right font-medium">{formatCurrency(selectedOrder.tax)}</td>
                            </tr>
                          )}
                          <tr className="border-t-2 border-gray-300">
                            <td colSpan={4} className="py-2 px-3 text-right font-semibold">Total</td>
                            <td className="py-2 px-3 text-right font-semibold">{formatCurrency(selectedOrder.totalAmount)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {selectedOrder.files && selectedOrder.files.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center">
                      <Download className="h-5 w-5 mr-2" />
                      Files ({selectedOrder.files.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedOrder.files.map((file) => (
                        <a
                          key={file.fileId}
                          href={file.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Download className="h-4 w-4 text-gray-400 shrink-0" />
                            <span className="text-sm font-medium truncate">{file.fileName}</span>
                          </div>
                          <span className="text-xs text-gray-400 shrink-0 ml-2">{file.fileType}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}