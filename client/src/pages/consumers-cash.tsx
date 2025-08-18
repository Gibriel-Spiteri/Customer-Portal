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
import { useState, useMemo } from 'react';
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

export default function ConsumersCash() {
  const { user, token } = useAuth();
  const { triggerLiveSync } = useSync();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(25);
  
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
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Consumers Cash</h1>
            <p className="mt-1 text-gray-600">
              Your CRD rebate rewards and transaction history
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <DataBadge freshness="live" />
            <Button
              onClick={handleDownloadCSV}
              variant="outline"
              size="sm"
              disabled={isLoading || !data?.rebates?.length}
            >
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
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
          <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(data?.summary.totalAvailable || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Ready to use</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redeemed</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(data?.summary.totalRedeemed || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Already used</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <Clock className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {formatCurrency(data?.summary.totalExpired || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Past expiration</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Rebate Level</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary.customerRebateRate || '10'}%</div>
            <p className="text-xs text-muted-foreground">Active rate</p>
            {data?.summary.qualifyingSales && (
              <div className="mt-2 pt-2 border-t">
                <p className="text-xs text-muted-foreground">12-Month Qualifying Sales</p>
                <p className="text-sm font-semibold">
                  {formatCurrency(data.summary.qualifyingSales)}
                </p>
              </div>
            )}
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
              <div className="space-y-4">
                {paginatedRebates.map((rebate) => (
                <div
                  key={rebate.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {getStatusIcon(rebate.status)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg">
                          {formatCurrency(rebate.amount)}
                        </span>
                        <Badge className={getStatusColor(rebate.status)}>
                          {rebate.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(rebate.date)}
                        </span>
                        
                        {rebate.salesOrder && (
                          <span className="flex items-center gap-1">
                            <ShoppingCart className="h-3 w-3" />
                            Order: {rebate.salesOrder}
                          </span>
                        )}
                      </div>
                      
                      {rebate.expirationDate && (
                        <div className="text-sm">
                          {rebate.status === 'Earned' ? (
                            <span className="text-orange-600 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Expires: {formatDate(rebate.expirationDate)}
                            </span>
                          ) : rebate.status === 'Expired' ? (
                            <span className="text-gray-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Expired: {formatDate(rebate.expirationDate)}
                            </span>
                          ) : null}
                        </div>
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
    </MobileLayout>
  );
}