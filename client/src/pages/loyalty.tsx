import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useSync } from "@/contexts/sync-context";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { DataBadge } from "@/components/data-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Gift, 
  Star, 
  TrendingUp, 
  CreditCard, 
  Award,
  Calendar,
  DollarSign,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { useState } from "react";

interface LoyaltyAccount {
  id: string;
  userId: string;
  programName: string;
  memberNumber: string;
  memberSince: string;
  tier: string;
  totalPoints: number;
  availablePoints: number;
  cashValue: string;
  lifetimeEarnings: string;
  nextTierPoints: number | null;
  nextTierName: string | null;
  expiringPoints?: {
    amount: number;
    expirationDate: string;
  };
  dataFreshness: 'live' | 'cached';
  lastSyncAt: string;
}

interface LoyaltyTransaction {
  id: string;
  type: 'earned' | 'redeemed' | 'expired';
  points: number;
  description: string;
  transactionDate: string;
  orderId?: string;
  redemptionDetails?: any;
}

interface LoyaltyReward {
  id: string;
  name: string;
  description: string;
  pointsRequired: number;
  category: string;
  available: boolean;
  imageUrl?: string;
  terms?: string;
}

export default function Loyalty() {
  const { user, token } = useAuth();
  const { triggerLiveSync } = useSync();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: loyaltyAccount, isLoading: accountLoading, error: accountError, refetch: refetchAccount } = useQuery<LoyaltyAccount>({
    queryKey: ['/api/loyalty/account'],
    enabled: !!token,
  });

  const { data: transactions, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery<LoyaltyTransaction[]>({
    queryKey: ['/api/loyalty/transactions'],
    enabled: !!token,
  });

  const { data: rewards, isLoading: rewardsLoading } = useQuery<LoyaltyReward[]>({
    queryKey: ['/api/loyalty/rewards'],
    enabled: !!token,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await triggerLiveSync('loyalty');
      await Promise.all([refetchAccount(), refetchTransactions()]);
      toast({
        title: "Loyalty Data Updated",
        description: "Your Consumers Cash information has been refreshed.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Unable to refresh loyalty data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      bronze: 'bg-amber-100 text-amber-800',
      silver: 'bg-gray-100 text-gray-800',
      gold: 'bg-yellow-100 text-yellow-800',
      platinum: 'bg-purple-100 text-purple-800',
      diamond: 'bg-blue-100 text-blue-800',
    };
    return colors[tier.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  const getTierProgress = () => {
    if (!loyaltyAccount || !loyaltyAccount.nextTierPoints) return 0;
    const currentTierBase = loyaltyAccount.totalPoints - loyaltyAccount.nextTierPoints;
    const progress = (loyaltyAccount.totalPoints / (loyaltyAccount.totalPoints + loyaltyAccount.nextTierPoints)) * 100;
    return Math.min(progress, 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  if (!user) {
    return <div>Please log in to view your loyalty account</div>;
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
                    <h1 className="text-2xl font-bold text-gray-900">Consumers Cash</h1>
                    <p className="mt-1 text-gray-600">
                      Manage your loyalty rewards and track your earnings.
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {loyaltyAccount && <DataBadge freshness={loyaltyAccount.dataFreshness} />}
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

              {accountError ? (
                <Card className="mb-6 border-red-200 bg-red-50">
                  <CardContent className="pt-6">
                    <p className="text-red-800">Failed to load loyalty account. Please try refreshing the page.</p>
                  </CardContent>
                </Card>
              ) : accountLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                      <CardContent className="pt-6">
                        <Skeleton className="h-20" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : loyaltyAccount ? (
                <>
                  {/* Account Overview Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center text-lg">
                          <Star className="h-5 w-5 mr-2 text-yellow-500" />
                          Points Balance
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-3xl font-bold text-gray-900">
                            {loyaltyAccount.availablePoints.toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-600">
                            Cash Value: {formatCurrency(loyaltyAccount.cashValue)}
                          </p>
                          {loyaltyAccount.expiringPoints && (
                            <p className="text-sm text-orange-600 font-medium">
                              {loyaltyAccount.expiringPoints.amount.toLocaleString()} points expiring {formatDate(loyaltyAccount.expiringPoints.expirationDate)}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center text-lg">
                          <Award className="h-5 w-5 mr-2 text-purple-500" />
                          Membership Tier
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <Badge className={`${getTierColor(loyaltyAccount.tier)} text-sm px-3 py-1`}>
                            {loyaltyAccount.tier.toUpperCase()}
                          </Badge>
                          <p className="text-sm text-gray-600">
                            Member since {formatDate(loyaltyAccount.memberSince)}
                          </p>
                          <p className="text-sm text-gray-600">
                            Member #: {loyaltyAccount.memberNumber}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center text-lg">
                          <TrendingUp className="h-5 w-5 mr-2 text-green-500" />
                          Lifetime Earnings
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-2xl font-bold text-gray-900">
                            {loyaltyAccount.totalPoints.toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-600">
                            Total earned: {formatCurrency(loyaltyAccount.lifetimeEarnings)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Tier Progress */}
                  {loyaltyAccount.nextTierName && loyaltyAccount.nextTierPoints && (
                    <Card className="mb-8">
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Award className="h-5 w-5 mr-2" />
                          Progress to {loyaltyAccount.nextTierName}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span>Current: {loyaltyAccount.tier}</span>
                            <span>{loyaltyAccount.nextTierPoints.toLocaleString()} points to {loyaltyAccount.nextTierName}</span>
                          </div>
                          <Progress value={getTierProgress()} className="h-3" />
                          <p className="text-sm text-gray-600">
                            Keep earning points to unlock exclusive {loyaltyAccount.nextTierName} benefits!
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : null}

              {/* Recent Transactions and Available Rewards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Transactions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Calendar className="h-5 w-5 mr-2" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {transactionsLoading ? (
                      <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                          <Skeleton key={i} className="h-16" />
                        ))}
                      </div>
                    ) : transactions && transactions.length > 0 ? (
                      <div className="space-y-3">
                        {transactions.slice(0, 8).map((transaction) => (
                          <div key={transaction.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                            <div className="flex items-center space-x-3">
                              {transaction.type === 'earned' ? (
                                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                  <TrendingUp className="h-4 w-4 text-green-600" />
                                </div>
                              ) : transaction.type === 'redeemed' ? (
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                  <Gift className="h-4 w-4 text-blue-600" />
                                </div>
                              ) : (
                                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                                  <Calendar className="h-4 w-4 text-red-600" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-gray-900">{transaction.description}</p>
                                <p className="text-sm text-gray-600">{formatDate(transaction.transactionDate)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-semibold ${
                                transaction.type === 'earned' ? 'text-green-600' : 
                                transaction.type === 'redeemed' ? 'text-blue-600' : 'text-red-600'
                              }`}>
                                {transaction.type === 'earned' ? '+' : '-'}{transaction.points.toLocaleString()}
                              </p>
                              <p className="text-sm text-gray-500">points</p>
                            </div>
                          </div>
                        ))}
                        <Button variant="outline" className="w-full mt-4">
                          View All Transactions
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Recent Activity</h3>
                        <p className="text-gray-600">Start earning points with your next purchase!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Available Rewards */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Gift className="h-5 w-5 mr-2" />
                      Available Rewards
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {rewardsLoading ? (
                      <div className="space-y-3">
                        {[...Array(4)].map((_, i) => (
                          <Skeleton key={i} className="h-20" />
                        ))}
                      </div>
                    ) : rewards && rewards.length > 0 ? (
                      <div className="space-y-3">
                        {rewards.slice(0, 6).map((reward) => (
                          <div key={reward.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                            <div>
                              <h4 className="font-medium text-gray-900">{reward.name}</h4>
                              <p className="text-sm text-gray-600">{reward.description}</p>
                              <p className="text-sm font-medium text-blue-600">{reward.pointsRequired.toLocaleString()} points</p>
                            </div>
                            <Button 
                              size="sm" 
                              disabled={!reward.available || (loyaltyAccount && loyaltyAccount.availablePoints < reward.pointsRequired)}
                              variant={loyaltyAccount && loyaltyAccount.availablePoints >= reward.pointsRequired ? "default" : "outline"}
                            >
                              {loyaltyAccount && loyaltyAccount.availablePoints >= reward.pointsRequired ? 'Redeem' : 'Not Available'}
                            </Button>
                          </div>
                        ))}
                        <Button variant="outline" className="w-full mt-4">
                          View All Rewards
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Rewards Available</h3>
                        <p className="text-gray-600">Check back later for new reward opportunities!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <Card className="mt-8">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button variant="outline" className="h-16">
                      <div className="text-center">
                        <CreditCard className="h-6 w-6 mx-auto mb-1" />
                        <span className="text-sm">Redeem Points</span>
                      </div>
                    </Button>
                    <Button variant="outline" className="h-16">
                      <div className="text-center">
                        <DollarSign className="h-6 w-6 mx-auto mb-1" />
                        <span className="text-sm">Convert to Cash</span>
                      </div>
                    </Button>
                    <Button variant="outline" className="h-16">
                      <div className="text-center">
                        <ExternalLink className="h-6 w-6 mx-auto mb-1" />
                        <span className="text-sm">Program Terms</span>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}