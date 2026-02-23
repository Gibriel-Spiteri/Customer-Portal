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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { 
  Calculator,
  Download,
  Send,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  FileText
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { OAuthAuthorize } from "@/components/oauth-authorize";
import { queryClient } from "@/lib/queryClient";

interface EstimateItem {
  id?: string;
  name: string;
  itemName?: string;
  description?: string;
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
  subtotal?: string;
  tax?: string;
  shipping?: string;
}

export default function Estimates() {
  const { user, token } = useAuth();
  const [showOAuthAuthorize, setShowOAuthAuthorize] = useState(false);
  const [, setLocation] = useLocation();
  const [syncStatusCollapsed, setSyncStatusCollapsed] = useState(true);
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
  const [loadingEstimateDetails, setLoadingEstimateDetails] = useState(false);

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


              {/* Estimate Details Modal */}
              <Dialog open={!!selectedEstimate} onOpenChange={() => setSelectedEstimate(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                      <span>Estimate #{selectedEstimate?.estimateNumber}</span>
                      {selectedEstimate && (
                        <Badge className={getStatusColor(selectedEstimate.status)}>
                          {selectedEstimate.status.charAt(0).toUpperCase() + selectedEstimate.status.slice(1)}
                        </Badge>
                      )}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                      Details for estimate {selectedEstimate?.estimateNumber}
                    </DialogDescription>
                  </DialogHeader>
                  
                  {selectedEstimate && (
                    <div className="space-y-6 mt-4">
                      {/* End User and Job ID */}
                      {(selectedEstimate.memo || selectedEstimate.tagFor) && (
                        <div className="grid grid-cols-2 gap-4">
                          {selectedEstimate.tagFor && (
                            <div>
                              <h3 className="text-sm font-medium text-gray-500 mb-1">End User</h3>
                              <p className="text-base">{selectedEstimate.tagFor}</p>
                            </div>
                          )}
                          {selectedEstimate.memo && (
                            <div>
                              <h3 className="text-sm font-medium text-gray-500 mb-1">Job ID</h3>
                              <p className="text-base">{selectedEstimate.memo}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Estimate Summary */}
                      <Separator />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1">Estimate Date</h3>
                          <p className="text-base flex items-center">
                            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                            {formatDate(selectedEstimate.estimateDate)}
                          </p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Amount</h3>
                          <p className="text-lg font-semibold">
                            {formatCurrency(selectedEstimate.amount || selectedEstimate.totalAmount || '0', selectedEstimate.currency)}
                          </p>
                        </div>
                      </div>

                      {/* Estimate Items */}
                      {loadingEstimateDetails ? (
                        <>
                          <Separator />
                          <div className="space-y-3">
                            <h3 className="text-lg font-semibold flex items-center">
                              <ShoppingCart className="h-5 w-5 mr-2" />
                              Line Items
                            </h3>
                            <div className="animate-pulse space-y-2">
                              <div className="h-12 bg-gray-200 rounded"></div>
                              <div className="h-12 bg-gray-200 rounded"></div>
                              <div className="h-12 bg-gray-200 rounded"></div>
                            </div>
                          </div>
                        </>
                      ) : selectedEstimate.items && selectedEstimate.items.length > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-3">
                            <h3 className="text-lg font-semibold flex items-center">
                              <ShoppingCart className="h-5 w-5 mr-2" />
                              Line Items
                            </h3>
                            <div className="space-y-2">
                              {(() => {
                                const allItems = selectedEstimate.items || [];
                                
                                const displayItems = allItems.filter(item => {
                                  const itemName = item.itemName || '';
                                  const itemNameLower = itemName.toLowerCase();
                                  const amount = parseFloat(item.amount || 0);
                                  
                                  const isTaxItem = itemName.includes('NY_') || 
                                                   itemNameLower.includes('ny_suffolk') ||
                                                   itemNameLower.includes('ny_bhdl') ||
                                                   itemNameLower.includes('ny_ny') ||
                                                   (itemNameLower.includes('tax') && !itemNameLower.includes('we pay the tax'));
                                  const isShippingItem = itemNameLower.includes('delivered') || itemNameLower.includes('ups') || itemNameLower.includes('shipping');
                                  
                                  return Math.abs(amount) > 0.01 && !isTaxItem && !isShippingItem;
                                });
                                
                                let productsTotal = 0;
                                let shippingTotal = 0;
                                
                                allItems.forEach(item => {
                                  const qty = Math.abs(parseFloat(item.quantity || 0));
                                  const rate = Math.abs(parseFloat(item.rate || 0));
                                  const amount = parseFloat(item.amount || 0);
                                  const itemNameLower = (item.itemName || '').toLowerCase();
                                  
                                  const itemTotal = qty > 0 ? qty * rate : Math.abs(amount);
                                  
                                  if (itemNameLower.includes('delivered') || itemNameLower.includes('ups') || itemNameLower.includes('shipping')) {
                                    shippingTotal += itemTotal;
                                  } else if (
                                    itemNameLower === 'customer discount' ||
                                    itemNameLower.includes('% off') ||
                                    itemNameLower.includes('% discount') ||
                                    itemNameLower === 'discount' ||
                                    itemNameLower.includes('we pay the tax') ||
                                    itemNameLower.includes('we pay') ||
                                    itemNameLower.includes('credit') ||
                                    itemNameLower.includes('ny_') ||
                                    (itemNameLower.includes('tax') && !itemNameLower.includes('we pay the tax'))
                                  ) {
                                    // Skip - handled by discountTotal from NetSuite
                                  } else {
                                    productsTotal += itemTotal;
                                  }
                                });
                                
                                const discountTotal = Math.abs(parseFloat(selectedEstimate.discountTotal || '0'));
                                const subtotal = productsTotal;
                                
                                return (
                                  <>
                                    {displayItems.map((item, index) => {
                                      const quantity = parseFloat(item.quantity || 0);
                                      const rate = parseFloat(item.rate || 0);
                                      const amount = parseFloat(item.amount || 0);
                                      const itemNameLower = (item.itemName || '').toLowerCase();
                                      
                                      const displayQuantity = Math.abs(quantity);
                                      const displayRate = Math.abs(rate);
                                      
                                      let displayAmount = displayQuantity > 0 
                                        ? displayQuantity * displayRate 
                                        : Math.abs(amount);
                                      
                                      let bgColor = "bg-gray-50";
                                      let textColor = "text-gray-900";
                                      let descColor = "text-gray-600";
                                      let isNegative = false;
                                      
                                      if (itemNameLower === 'customer discount') {
                                        bgColor = "bg-yellow-50";
                                        textColor = "text-yellow-900";
                                        descColor = "text-yellow-700";
                                        isNegative = true;
                                      } else if (itemNameLower.includes('credit') || itemNameLower.includes('we pay the tax') || itemNameLower.includes('we pay')) {
                                        bgColor = "bg-green-50";
                                        textColor = "text-green-900";
                                        descColor = "text-green-700";
                                        isNegative = true;
                                      } else if (itemNameLower.includes('% off') || itemNameLower.includes('% discount') || itemNameLower === 'discount') {
                                        bgColor = "bg-green-50";
                                        textColor = "text-green-900";
                                        descColor = "text-green-700";
                                        isNegative = true;
                                      }
                                      
                                      return (
                                        <div key={`item-${item.id || index}`} className={`${bgColor} p-3 rounded-lg`}>
                                          <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                              <h4 className={`font-medium ${textColor}`}>
                                                {item.itemName || item.name}
                                              </h4>
                                              {item.description && 
                                                !item.description.toLowerCase().includes('click print for description') && (
                                                <p className={`text-sm ${descColor} mt-1`}>{item.description}</p>
                                              )}
                                            </div>
                                            <div className="text-right ml-4 w-24">
                                              <p className={`font-semibold ${textColor}`}>
                                                {isNegative ? '-' : ''}${displayAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                              </p>
                                              {displayQuantity > 0 && (
                                                <p className={`text-sm ${descColor}`}>
                                                  {displayQuantity} × ${displayRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    
                                    {/* Estimate Summary */}
                                    <div className="mt-4 pt-4 border-t-2 border-gray-300 space-y-2 bg-gray-50 p-4 rounded-lg">
                                      <h4 className="font-semibold text-gray-900 mb-2">Summary</h4>
                                      
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">SUBTOTAL</span>
                                        <span className="font-medium">${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                      
                                      {discountTotal > 0 && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-gray-600">DISCOUNTS</span>
                                          <span className="font-medium">-${discountTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                      )}
                                      
                                      {selectedEstimate.tax && parseFloat(selectedEstimate.tax) > 0 && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-gray-600">TAX</span>
                                          <span className="font-medium">${parseFloat(selectedEstimate.tax).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                      )}
                                      
                                      {shippingTotal > 0 && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-gray-600">SHIPPING CHARGES</span>
                                          <span className="font-medium">${shippingTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                      )}
                                      
                                      <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-300">
                                        <span>TOTAL</span>
                                        <span>${parseFloat(selectedEstimate.amount || selectedEstimate.totalAmount || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Description */}
                      {selectedEstimate.description && (
                        <>
                          <Separator />
                          <div className="space-y-3">
                            <h3 className="text-lg font-semibold flex items-center">
                              <FileText className="h-5 w-5 mr-2" />
                              Description
                            </h3>
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <p className="text-base">{selectedEstimate.description}</p>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Action Buttons */}
                      <div className="flex justify-end space-x-3 pt-4">
                        <Button 
                          variant="outline" 
                          onClick={() => setSelectedEstimate(null)}
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}