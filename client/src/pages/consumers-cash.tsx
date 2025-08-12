import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, 
  Calendar, 
  ShoppingCart, 
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  ChevronLeft,
  Coins
} from 'lucide-react';

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
  status: 'Available' | 'Redeemed' | 'Expired' | 'Reversed';
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

export function ConsumersCashPage() {
  const [location, setLocation] = useLocation();
  
  const { data, isLoading, error } = useQuery<CRDRebatesResponse>({
    queryKey: ['/api/crd-rebates'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Button 
            onClick={() => setLocation('/dashboard')}
            variant="ghost" 
            size="sm"
            className="mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Button>
          
          <div className="flex items-center gap-3 mb-2">
            <Coins className="h-8 w-8 text-green-600" />
            <h1 className="text-3xl font-bold">Consumers Cash</h1>
          </div>
          <p className="text-gray-600">Your CRD rebate rewards and history</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Loading Rebate History...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Button 
          onClick={() => setLocation('/dashboard')}
          variant="ghost" 
          size="sm"
          className="mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Button>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load Consumers Cash data. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

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
      case 'Available':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Redeemed':
        return <DollarSign className="h-4 w-4 text-blue-600" />;
      case 'Expired':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'Reversed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available':
        return 'bg-green-100 text-green-800';
      case 'Redeemed':
        return 'bg-blue-100 text-blue-800';
      case 'Expired':
        return 'bg-gray-100 text-gray-800';
      case 'Reversed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Button 
          onClick={() => setLocation('/dashboard')}
          variant="ghost" 
          size="sm"
          className="mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Button>
        
        <div className="flex items-center gap-3 mb-2">
          <Coins className="h-8 w-8 text-green-600" />
          <h1 className="text-3xl font-bold">Consumers Cash</h1>
        </div>
        <p className="text-gray-600">Your CRD rebate rewards and history</p>
      </div>

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
                          {rebate.status === 'Available' ? (
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
    </div>
  );
}