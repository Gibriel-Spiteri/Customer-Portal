import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { SyncStatusDetail } from "@/components/sync-status";
import { DataBadge } from "@/components/data-badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  DollarSign,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Link, useLocation } from "wouter";
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
  memo?: string;
  tagFor?: string;
  items?: EstimateItem[];
  dataFreshness?: 'live' | 'cached';
  customerName?: string;
  totalAmount?: string;
  lastSyncAt?: string;
}

export default function Estimates() {
  const { user, token } = useAuth();
  const [showOAuthAuthorize, setShowOAuthAuthorize] = useState(false);
  const [, setLocation] = useLocation();
  const [syncStatusCollapsed, setSyncStatusCollapsed] = useState(true);

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
      open: 'bg-green-100 text-green-800',
      accepted: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
      rejected: 'bg-red-100 text-red-800',
      closed: 'bg-gray-100 text-gray-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
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



              {/* Estimates List */}
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
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-full" />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : error ? (
                  <Card className="border-red-200 bg-red-50">
                    <CardContent className="text-center py-8">
                      <div className="text-red-800">
                        Failed to load estimates. Please try again.
                      </div>
                    </CardContent>
                  </Card>
                ) : estimates.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8">
                      <Calculator className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-gray-500">No estimates found</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Your estimates will appear here once created in NetSuite
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  estimates.map((estimate) => (
                    <Card key={estimate.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {estimate.estimateNumber}
                            </h3>
                            <p className="text-sm text-gray-600">
                              Estimate Date: {formatDate(estimate.estimateDate)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-gray-900">
                              {formatCurrency(estimate.amount || estimate.totalAmount || '0', estimate.currency)}
                            </p>
                            <div className="flex items-center space-x-2 mt-1 justify-end">
                              <Badge variant="secondary" className={getStatusColor(estimate.status)}>
                                {estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
                              </Badge>
                              <DataBadge 
                                freshness={estimate.dataFreshness || 'live'} 
                                lastSync={estimate.lastSyncAt || new Date().toISOString()} 
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-500">Job ID:</span>
                            <p className="text-gray-900">{estimate.memo || '-'}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-500">End User:</span>
                            <p className="text-gray-900">{estimate.tagFor || '-'}</p>
                          </div>
                          <div className="flex justify-end items-end">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setLocation(`/estimates/${estimate.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                          </div>
                        </div>

                        {estimate.expiryDate && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="flex items-center text-sm">
                              <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                              <span className="text-gray-600">
                                Expires: {formatDate(estimate.expiryDate)}
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Data Synchronization Status - Collapsible */}
              <Card className="mt-6">
                <Collapsible open={!syncStatusCollapsed} onOpenChange={(open) => setSyncStatusCollapsed(!open)}>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Data Synchronization Status</CardTitle>
                        {syncStatusCollapsed ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronUp className="h-4 w-4 text-gray-500" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <SyncStatusDetail />
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}