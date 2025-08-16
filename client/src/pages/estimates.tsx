import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { SyncStatusDetail } from "@/components/sync-status";
import { DataBadge } from "@/components/data-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calculator,
  Download,
  Eye,
  Send,
  Calendar,
  DollarSign
} from "lucide-react";
import { Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OAuthAuthorize } from "@/components/oauth-authorize";
import { queryClient } from "@/lib/queryClient";

interface EstimateItem {
  name: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface Estimate {
  id: string;
  estimateNumber: string;
  status: string;
  amount: string;
  currency: string;
  estimateDate: string;
  expiryDate: string;
  description?: string;
  items?: EstimateItem[];
  dataFreshness?: 'live' | 'cached';
  customerName?: string;
  totalAmount?: string;
  lastSyncAt?: string;
}

export default function Estimates() {
  const { user, token } = useAuth();
  const [showOAuthAuthorize, setShowOAuthAuthorize] = useState(false);

  const { data: estimates = [], isLoading, error, refetch } = useQuery<Estimate[]>({
    queryKey: ['/api/estimates'],
    enabled: !!token,
    retry: (failureCount, error: any) => {
      // Don't retry if it's an OAuth error
      if (error?.status === 401 || error?.message?.includes('OAuth') || error?.message?.includes('authentication')) {
        setShowOAuthAuthorize(true);
        return false;
      }
      return failureCount < 3;
    }
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      viewed: 'bg-purple-100 text-purple-800',
      accepted: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount: string, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {/* Header */}
              <div className="mb-8 flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Estimates</h1>
                  <p className="mt-1 text-gray-600">
                    View and manage your price quotes
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  {/* SyncStatusDetail moved to bottom */}
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Active Estimates
                    </CardTitle>
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {estimates.filter(e => ['open', 'sent', 'viewed'].includes(e.status.toLowerCase())).length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Awaiting response
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Value
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(
                        estimates
                          .filter(e => ['open', 'sent', 'viewed'].includes(e.status.toLowerCase()))
                          .reduce((sum, e) => sum + parseFloat(e.amount || e.totalAmount || '0'), 0)
                          .toString()
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      In active estimates
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Accepted
                    </CardTitle>
                    <Send className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {estimates.filter(e => e.status.toLowerCase() === 'approved' || e.status.toLowerCase() === 'accepted').length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This month
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Expiring Soon
                    </CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {estimates.filter(e => {
                        const status = e.status.toLowerCase();
                        if (status !== 'open' && status !== 'sent' && status !== 'viewed') return false;
                        const daysUntilExpiry = Math.floor(
                          (new Date(e.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                        );
                        return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
                      }).length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Within 7 days
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Estimates Table */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>All Estimates</CardTitle>
                    <Button variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : error ? (
                    <div className="text-center py-8 text-red-600">
                      Failed to load estimates. Please try again.
                    </div>
                  ) : estimates.length === 0 ? (
                    <div className="text-center py-8">
                      <Calculator className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-gray-500">No estimates found</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Your estimates will appear here once created in NetSuite
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Estimate #</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {estimates.map((estimate) => (
                          <TableRow key={estimate.id}>
                            <TableCell className="font-medium">
                              {estimate.estimateNumber}
                            </TableCell>
                            <TableCell>
                              {estimate.customerName || estimate.description || 'N/A'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <span>{formatDate(estimate.estimateDate)}</span>
                                <DataBadge 
                                  freshness={estimate.dataFreshness || 'live'} 
                                  lastSync={estimate.lastSyncAt || new Date().toISOString()} 
                                />
                              </div>
                            </TableCell>
                            <TableCell>{formatDate(estimate.expiryDate)}</TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(estimate.amount || estimate.totalAmount || '0', estimate.currency)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={getStatusColor(estimate.status)}>
                                {estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Data Synchronization Status */}
              <div className="mt-6">
                <SyncStatusDetail />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}