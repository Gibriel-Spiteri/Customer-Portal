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
  Download
} from 'lucide-react';
import { useState } from 'react';
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
  
  const { data, isLoading, error, refetch } = useQuery<CRDRebatesResponse>({
    queryKey: ['/api/crd-rebates'],
    enabled: !!token,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

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
            <CardTitle className="text-sm font-medium">Total Rebates</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary.totalRebates || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Rebate History */}
      <Card>
        <CardHeader>
          <CardTitle>Rebate History</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.rebates || data.rebates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Coins className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No rebates found for your account</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.rebates.map((rebate) => (
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
                        
                        {rebate.earnedPercent && (
                          <span>
                            Rate: {rebate.earnedPercent}%
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
                      
                      {rebate.applyingTransaction && (
                        <div className="text-sm text-blue-600">
                          Applied to transaction: {rebate.applyingTransaction}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {rebate.category && (
                      <Badge variant="outline" className="text-xs">
                        {rebate.category}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}
    </MobileLayout>
  );
}