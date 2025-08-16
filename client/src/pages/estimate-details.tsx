import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft,
  Calendar,
  DollarSign,
  FileText,
  User,
  MapPin,
  Clock
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface EstimateDetails {
  id: string;
  estimateNumber: string;
  status: string;
  total: string;
  subtotal: string;
  tax: string;
  shipping: string;
  currency: string;
  estimateDate: string;
  expiryDate: string;
  memo: string;
  tagFor: string;
  customerName: string;
  location: string;
  shippingAddress: string;
  billingAddress: string;
  items: Array<{
    lineId: string;
    lineNumber: number;
    itemName: string;
    quantity: number;
    rate: number;
    amount: number;
    description: string;
  }>;
}

export default function EstimateDetails() {
  const { user, token } = useAuth();
  const params = useParams();
  const estimateId = params.id;

  const { data: estimate, isLoading, error } = useQuery<EstimateDetails>({
    queryKey: [`/api/estimates/${estimateId}`],
    enabled: !!token && !!estimateId,
  });

  const formatCurrency = (amount: string, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(parseFloat(amount || '0'));
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
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
              <div className="mb-8">
                <Link href="/estimates">
                  <Button variant="ghost" size="sm" className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Estimates
                  </Button>
                </Link>
                
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      Estimate {estimate?.estimateNumber || '#' + estimateId}
                    </h1>
                    <p className="mt-1 text-gray-600">
                      View estimate details and line items
                    </p>
                  </div>
                  {estimate && (
                    <Badge variant="secondary" className={getStatusColor(estimate.status)}>
                      {estimate.status?.charAt(0).toUpperCase() + estimate.status?.slice(1)}
                    </Badge>
                  )}
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : error ? (
                <Card>
                  <CardContent className="text-center py-8 text-red-600">
                    Failed to load estimate details. Please try again.
                  </CardContent>
                </Card>
              ) : estimate ? (
                <div className="space-y-6">
                  {/* Overview Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatCurrency(estimate.total, estimate.currency)}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Date Created</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-lg font-medium">
                          {formatDate(estimate.estimateDate)}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Expires On</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-lg font-medium">
                          {formatDate(estimate.expiryDate)}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Customer</CardTitle>
                        <User className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-lg font-medium">
                          {estimate.customerName || 'N/A'}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Details Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Estimate Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h3 className="font-semibold text-sm text-gray-600 mb-1">Job ID</h3>
                          <p className="text-gray-900">{estimate.memo || '-'}</p>
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-gray-600 mb-1">End User</h3>
                          <p className="text-gray-900">{estimate.tagFor || '-'}</p>
                        </div>
                        {estimate.location && (
                          <div>
                            <h3 className="font-semibold text-sm text-gray-600 mb-1">Location</h3>
                            <p className="text-gray-900">{estimate.location}</p>
                          </div>
                        )}
                        {estimate.shippingAddress && (
                          <div>
                            <h3 className="font-semibold text-sm text-gray-600 mb-1">Shipping Address</h3>
                            <p className="text-gray-900 whitespace-pre-line">{estimate.shippingAddress}</p>
                          </div>
                        )}
                        {estimate.billingAddress && (
                          <div>
                            <h3 className="font-semibold text-sm text-gray-600 mb-1">Billing Address</h3>
                            <p className="text-gray-900 whitespace-pre-line">{estimate.billingAddress}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Line Items */}
                  {estimate.items && estimate.items.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Line Items</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px]">#</TableHead>
                              <TableHead>Item</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead className="text-right">Rate</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {estimate.items.map((item) => (
                              <TableRow key={item.lineId}>
                                <TableCell>{item.lineNumber}</TableCell>
                                <TableCell className="font-medium">{item.itemName}</TableCell>
                                <TableCell>{item.description || '-'}</TableCell>
                                <TableCell className="text-right">{item.quantity}</TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(item.rate.toString(), estimate.currency)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(item.amount.toString(), estimate.currency)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        {/* Totals */}
                        <div className="mt-6 border-t pt-4">
                          <div className="space-y-2">
                            {estimate.subtotal && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Subtotal</span>
                                <span className="font-medium">
                                  {formatCurrency(estimate.subtotal, estimate.currency)}
                                </span>
                              </div>
                            )}
                            {estimate.tax && parseFloat(estimate.tax) > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Tax</span>
                                <span className="font-medium">
                                  {formatCurrency(estimate.tax, estimate.currency)}
                                </span>
                              </div>
                            )}
                            {estimate.shipping && parseFloat(estimate.shipping) > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Shipping</span>
                                <span className="font-medium">
                                  {formatCurrency(estimate.shipping, estimate.currency)}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between pt-2 border-t">
                              <span className="text-lg font-semibold">Total</span>
                              <span className="text-lg font-semibold">
                                {formatCurrency(estimate.total, estimate.currency)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500">Estimate not found</p>
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