import { useState, useEffect } from "react";
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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { OAuthAuthorize } from "@/components/oauth-authorize";
import { queryClient } from "@/lib/queryClient";
import { EstimateDetailModal, type EstimateDetail } from "@/components/estimate-detail-modal";

export default function Estimates() {
  const { user, token } = useAuth();
  const [showOAuthAuthorize, setShowOAuthAuthorize] = useState(false);
  const [, setLocation] = useLocation();
  const [syncStatusCollapsed, setSyncStatusCollapsed] = useState(true);
  const [selectedEstimate, setSelectedEstimate] = useState<EstimateDetail | null>(null);
  const [loadingEstimateDetails, setLoadingEstimateDetails] = useState(false);

  const { data: estimates = [], isLoading, error, refetch } = useQuery<EstimateDetail[]>({
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openId = params.get('open');
    if (openId && estimates.length > 0 && !selectedEstimate) {
      const estimate = estimates.find((e) => e.id === openId);
      if (estimate) {
        setSelectedEstimate(estimate);
        setLoadingEstimateDetails(true);
        fetch(`/api/estimates/${estimate.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => { if (data) setSelectedEstimate(data); })
          .catch(() => {})
          .finally(() => setLoadingEstimateDetails(false));
        window.history.replaceState({}, '', '/estimates');
      }
    }
  }, [estimates, token]);

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

  const toTitleCase = (str: string) => {
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
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
              {isLoading ? (
                <Card>
                  <CardContent className="p-0">
                    <div className="space-y-1 p-4">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 py-3">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-40 flex-1" />
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-6 w-16" />
                          <Skeleton className="h-8 w-20" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
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
                <>
                  {/* Desktop table - hidden on mobile */}
                  <Card className="hidden md:block">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">All Estimates</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Estimate ID</th>
                              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">CRD End User</th>
                              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Job ID</th>
                              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Date</th>
                              <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Amount</th>
                              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {estimates.map((estimate) => (
                              <tr 
                                key={estimate.id} 
                                className="hover:bg-gray-50 transition-colors cursor-pointer"
                                onClick={async () => {
                                  setSelectedEstimate(estimate);
                                  setLoadingEstimateDetails(true);
                                  try {
                                    const response = await fetch(`/api/estimates/${estimate.id}`, {
                                      headers: { 'Authorization': `Bearer ${token}` }
                                    });
                                    if (response.ok) {
                                      setSelectedEstimate(await response.json());
                                    }
                                  } catch (error) {
                                    console.error('Failed to fetch estimate details:', error);
                                  } finally {
                                    setLoadingEstimateDetails(false);
                                  }
                                }}
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{estimate.estimateNumber}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{estimate.tagFor ? toTitleCase(estimate.tagFor) : '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{estimate.memo ? toTitleCase(estimate.memo) : '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(estimate.estimateDate)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">{formatCurrency(estimate.amount || estimate.totalAmount || '0', estimate.currency)}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <Badge variant="secondary" className={getStatusColor(estimate.status)}>
                                    {estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Mobile cards - hidden on desktop */}
                  <div className="md:hidden space-y-3">
                    <h3 className="text-base font-semibold text-gray-900 px-1">All Estimates</h3>
                    {estimates.map((estimate) => (
                      <Card 
                        key={estimate.id} 
                        className="cursor-pointer active:bg-gray-50 transition-colors"
                        onClick={async () => {
                          setSelectedEstimate(estimate);
                          setLoadingEstimateDetails(true);
                          try {
                            const response = await fetch(`/api/estimates/${estimate.id}`, {
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (response.ok) {
                              setSelectedEstimate(await response.json());
                            }
                          } catch (error) {
                            console.error('Failed to fetch estimate details:', error);
                          } finally {
                            setLoadingEstimateDetails(false);
                          }
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{estimate.estimateNumber}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{formatDate(estimate.estimateDate)}</p>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">{formatCurrency(estimate.amount || estimate.totalAmount || '0', estimate.currency)}</p>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-700 space-y-1">
                              {estimate.tagFor && <p className="font-medium"><span className="text-gray-400 text-xs">End User:</span> {toTitleCase(estimate.tagFor)}</p>}
                              {estimate.memo && <p className="font-medium"><span className="text-gray-400 text-xs">Job ID:</span> {toTitleCase(estimate.memo)}</p>}
                            </div>
                            <Badge variant="secondary" className={getStatusColor(estimate.status)}>
                              {estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}


              <EstimateDetailModal
                estimate={selectedEstimate}
                loading={loadingEstimateDetails}
                onClose={() => setSelectedEstimate(null)}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}