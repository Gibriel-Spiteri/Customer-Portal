import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Clock,
  Package,
  CreditCard,
  CheckCircle,
  XCircle,
  Truck,
  Calendar,
  ShoppingCart,
  MapPin,
  ChevronDown,
  ChevronUp,
  DollarSign,
} from "lucide-react";

export interface OrderItem {
  id: string;
  lineNumber: number;
  itemName: string;
  quantity: number;
  rate: string;
  amount: string;
  description: string;
  discountPercent?: string;
  itemDescription?: string;
  cabBuildId?: string;
  cntrBuildId?: string;
}

export interface OrderFile {
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

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: string;
  targetReceiptDate?: string | null;
  shipDate: string | null;
  deliveryDate: string | null;
  totalAmount: string;
  balanceDue?: string;
  subtotal?: string;
  tax?: string;
  shipping?: string;
  discountTotal?: string;
  currency: string;
  shippingAddress: any;
  trackingNumber: string | null;
  memo?: string;
  tagFor?: string;
  salesRepPreferredName?: string;
  items?: OrderItem[];
  files?: OrderFile[];
  praDetails?: Array<{
    praId: string;
    praNumber: string;
    praCode: string;
    praCodeName: string;
    discountRate: string;
    postedAmount: string;
    praType: string;
    praDescription: string;
  }>;
  dataFreshness: 'live' | 'cached';
  lastSyncAt: string;
}

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
  loadingOrderDetails?: boolean;
}

const mapNetSuiteStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    'A': 'pending',
    'B': 'pending approval',
    'C': 'cancelled',
    'D': 'partially fulfilled',
    'E': 'pending billing',
    'F': 'pending fulfillment',
    'G': 'fully billed',
    'H': 'closed',
  };
  return statusMap[status] || status.toLowerCase();
};

const getStatusIcon = (status: string) => {
  const icons: Record<string, JSX.Element> = {
    'pending': <Clock className="h-4 w-4" />,
    'pending approval': <Clock className="h-4 w-4" />,
    'pending fulfillment': <Package className="h-4 w-4" />,
    'pending billing': <CreditCard className="h-4 w-4" />,
    'partially fulfilled': <Truck className="h-4 w-4" />,
    'fully billed': <CheckCircle className="h-4 w-4" />,
    'closed': <CheckCircle className="h-4 w-4" />,
    'cancelled': <XCircle className="h-4 w-4" />,
  };
  return icons[status] || <Clock className="h-4 w-4" />;
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    'pending': 'bg-yellow-100 text-yellow-800',
    'pending approval': 'bg-orange-100 text-orange-800',
    'pending fulfillment': 'bg-blue-100 text-blue-800',
    'pending billing': 'bg-purple-100 text-purple-800',
    'partially fulfilled': 'bg-indigo-100 text-indigo-800',
    'fully billed': 'bg-green-100 text-green-800',
    'closed': 'bg-green-100 text-green-800',
    'cancelled': 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

const formatCurrency = (amount: string | number, currency = 'USD') => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(num || 0);
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export function OrderDetailModal({ order, onClose, loadingOrderDetails = false }: OrderDetailModalProps) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [cabinetBuildDetails, setCabinetBuildDetails] = useState<any>({});
  const [visibleBuildDetails, setVisibleBuildDetails] = useState<Record<string, boolean>>({});
  const [loadingCabinetBuild, setLoadingCabinetBuild] = useState<string | null>(null);
  const [discountsExpanded, setDiscountsExpanded] = useState(false);
  const [payingBalance, setPayingBalance] = useState(false);

  const handlePayBalance = async () => {
    if (!order) return;
    setPayingBalance(true);
    try {
      const response = await apiRequest('POST', '/api/pay-balance', { salesOrderId: order.id });
      const data = await response.json();
      if (data.success && data.paymentUrl) {
        window.open(data.paymentUrl, '_blank');
        toast({ title: "Payment page opened", description: "A new tab has been opened for you to complete your payment." });
      } else {
        toast({ title: "Request failed", description: data.message || "Unable to create payment request. Please try again.", variant: "destructive" });
      }
    } catch (error) {
      console.error('Pay balance error:', error);
      toast({ title: "Request failed", description: "Unable to create payment request. Please try again.", variant: "destructive" });
    } finally {
      setPayingBalance(false);
    }
  };

  useEffect(() => {
    setCabinetBuildDetails({});
    setVisibleBuildDetails({});
    setDiscountsExpanded(false);
  }, [order?.id]);

  const fetchCabinetBuildDetails = async (buildId: string, itemName: string) => {
    setLoadingCabinetBuild(itemName);
    try {
      const response = await apiRequest('GET', `/api/cabinet-build/${buildId}`);
      const data = await response.json();
      setCabinetBuildDetails((prev: any) => ({ ...prev, [itemName]: data }));
    } catch (error) {
      console.error('Failed to fetch cabinet build details:', error);
      toast({ title: "Failed to load details", description: "Unable to fetch cabinet build details. Please try again.", variant: "destructive" });
    } finally {
      setLoadingCabinetBuild(null);
    }
  };

  const fetchCounterBuildDetails = async (buildId: string, itemName: string) => {
    setLoadingCabinetBuild(itemName);
    try {
      const response = await apiRequest('GET', `/api/counter-build/${buildId}`);
      const data = await response.json();
      setCabinetBuildDetails((prev: any) => ({ ...prev, [itemName]: data }));
    } catch (error) {
      console.error('Failed to fetch counter build details:', error);
      toast({ title: "Failed to load details", description: "Unable to fetch counter build details. Please try again.", variant: "destructive" });
    } finally {
      setLoadingCabinetBuild(null);
    }
  };

  const handleClose = () => {
    setCabinetBuildDetails({});
    setVisibleBuildDetails({});
    onClose();
  };

  return (
    <Dialog open={!!order} onOpenChange={() => handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-0">
          <DialogTitle className="flex items-center justify-between">
            <span>Order #{order?.orderNumber}</span>
            {order && (
              <Badge className={getStatusColor(mapNetSuiteStatus(order.status))}>
                {getStatusIcon(mapNetSuiteStatus(order.status))}
                <span className="ml-1 capitalize">{mapNetSuiteStatus(order.status)}</span>
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Details for order #{order?.orderNumber}
          </DialogDescription>
        </DialogHeader>

        {order && (
          <div className="space-y-6">
            {(order.memo || order.tagFor || order.salesRepPreferredName) && (
              <div className="grid grid-cols-3 gap-4">
                {order.tagFor && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">End User</h4>
                    <p className="text-base">{order.tagFor}</p>
                  </div>
                )}
                {order.memo && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Job ID</h4>
                    <p className="text-base">{order.memo}</p>
                  </div>
                )}
                {order.salesRepPreferredName && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Sales Person</h4>
                    <p className="text-base">{order.salesRepPreferredName}</p>
                  </div>
                )}
              </div>
            )}

            <Separator />
            <div className="relative">
              <div className={`grid gap-4 ${order.targetReceiptDate ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'} ${!loadingOrderDetails && mapNetSuiteStatus(order.status) !== 'fully billed' && parseFloat(order.balanceDue || '0') > 0 ? 'md:pr-32' : ''}`}>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Order Date</h4>
                  <p className="text-base flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                    {formatDate(order.orderDate)}
                  </p>
                </div>
                {order.targetReceiptDate && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Target Receipt Date</h4>
                    <p className="text-base flex items-center" data-testid="text-target-receipt-date">
                      <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                      {formatDate(order.targetReceiptDate)}
                    </p>
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Total Amount</h4>
                  <p className="text-lg">{formatCurrency(order.totalAmount, order.currency)}</p>
                </div>
                {!loadingOrderDetails && mapNetSuiteStatus(order.status) !== 'fully billed' && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Balance Due</h4>
                  <p className="text-lg">{formatCurrency(order.balanceDue || '0', order.currency)}</p>
                </div>
                )}
              </div>
              <div className="mt-3 md:mt-0 md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2">
                {!loadingOrderDetails && mapNetSuiteStatus(order.status) !== 'fully billed' && parseFloat(order.balanceDue || '0') > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" className="whitespace-nowrap">
                      <DollarSign className="h-4 w-4 mr-1" />
                      Pay Balance
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Pay Balance Due</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will create a payment request for the remaining balance of {formatCurrency(order.balanceDue || '0', order.currency)} on order #{order.orderNumber}. The request will be sent to you via text message and email.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handlePayBalance} disabled={payingBalance}>
                        {payingBalance ? 'Sending...' : 'Confirm'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                )}
              </div>
            </div>

            {loadingOrderDetails && !order.items ? (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center">
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Order Items
                  </h3>
                  <div className="animate-pulse space-y-2">
                    <div className="h-12 bg-gray-200 rounded"></div>
                    <div className="h-12 bg-gray-200 rounded"></div>
                    <div className="h-12 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </>
            ) : order.items && order.items.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center">
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Order Items
                  </h3>
                  <div className="space-y-2">
                    {(() => {
                      const allItems = order.items || [];

                      const isDiscountItem = (name: string, itemType?: string) => {
                        const n = name.toLowerCase();
                        const t = (itemType || '').toLowerCase();
                        return t === 'discount' ||
                          n === 'customer discount' ||
                          n === 'discount' ||
                          n.includes('% off') ||
                          n.includes('% discount') ||
                          n.includes('we pay the tax') ||
                          n.includes('we pay') ||
                          n.includes('credit');
                      };

                      const isNonLineItemDiscount = (name: string) => {
                        const n = name.toLowerCase();
                        return n === 'customer discount';
                      };

                      const customerDiscountAmount = allItems
                        .filter(item => isNonLineItemDiscount(item.itemName || ''))
                        .reduce((sum, item) => sum + Math.abs(parseFloat(item.amount || '0')), 0);

                      const praItems = (order.praDetails || []).filter(pra => pra.praDescription);
                      const totalPraRate = praItems.reduce((sum, pra) => sum + Math.abs(parseFloat(pra.discountRate || '0')), 0);

                      const discountLineItems = praItems.map(pra => {
                        const rate = Math.abs(parseFloat(pra.discountRate || '0'));
                        const amount = praItems.length === 1
                          ? customerDiscountAmount
                          : (totalPraRate > 0 ? (rate / totalPraRate) * customerDiscountAmount : 0);
                        return { name: pra.praDescription, amount };
                      });

                      const displayItems = allItems.filter(item => {
                        const itemName = item.itemName || '';
                        const itemNameLower = itemName.toLowerCase();
                        const amount = parseFloat(item.amount || '0');
                        const rate = parseFloat(item.rate || '0');

                        const isShippingItem = itemNameLower.includes('delivered') || itemNameLower.includes('ups') || itemNameLower.includes('shipping');
                        const hasValue = Math.abs(amount) > 0.01 || Math.abs(rate) > 0.01;

                        return hasValue && !isShippingItem && !isNonLineItemDiscount(itemName);
                      });

                      let productsTotal = 0;
                      let shippingTotal = 0;

                      const isShippingItem = (name: string) => {
                        const n = name.toLowerCase();
                        return n.includes('delivered') || n.includes('ups') || n.includes('shipping');
                      };
                      allItems.forEach(item => {
                        const qty = Math.abs(parseFloat(String(item.quantity || 0)));
                        const rate = Math.abs(parseFloat(item.rate || '0'));
                        const amount = parseFloat(item.amount || '0');
                        const itemName = item.itemName || '';

                        const itemTotal = qty > 0 ? qty * rate : Math.abs(amount);

                        if (isShippingItem(itemName)) {
                          shippingTotal += itemTotal;
                        } else if (isNonLineItemDiscount(itemName)) {
                          // Skip non-line-item discounts (handled in DISCOUNTS section)
                        } else if (isDiscountItem(itemName, item.itemType)) {
                          // Line item discounts reduce the subtotal
                          productsTotal -= itemTotal;
                        } else {
                          productsTotal += itemTotal;
                        }
                      });

                      const discountTotal = Math.abs(parseFloat(order.discountTotal || '0'));
                      const subtotal = productsTotal;

                      return (
                        <>
                          {displayItems.map((item, index) => {
                            const quantity = parseFloat(String(item.quantity || 0));
                            const rate = parseFloat(item.rate || '0');
                            const amount = parseFloat(item.amount || '0');
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

                            const isDiscount = isDiscountItem(item.itemName || '', item.itemType);

                            if (isDiscount) {
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
                                      {isDiscount && item.description ? item.description : item.itemName}
                                    </h4>
                                    {!isDiscount && item.description &&
                                      !item.description.toLowerCase().includes('click print for description') && (
                                        <p className={`text-sm ${descColor} mt-1`}>{item.description}</p>
                                      )}
                                    {itemNameLower.includes('spcab') && (
                                      <div className="mt-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            if (visibleBuildDetails[item.itemName]) {
                                              setVisibleBuildDetails(prev => ({ ...prev, [item.itemName]: false }));
                                            } else {
                                              if (cabinetBuildDetails[item.itemName]) {
                                                setVisibleBuildDetails(prev => ({ ...prev, [item.itemName]: true }));
                                              } else {
                                                const buildIdOrOrderNum = item.cabBuildId || order.orderNumber;
                                                fetchCabinetBuildDetails(buildIdOrOrderNum, item.itemName);
                                                setVisibleBuildDetails(prev => ({ ...prev, [item.itemName]: true }));
                                              }
                                            }
                                          }}
                                          disabled={loadingCabinetBuild === item.itemName}
                                        >
                                          {loadingCabinetBuild === item.itemName ? 'Loading...' :
                                            visibleBuildDetails[item.itemName] ? 'Hide Details' : 'View Details'}
                                        </Button>

                                        {visibleBuildDetails[item.itemName] && cabinetBuildDetails[item.itemName] && (
                                          <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg">
                                            <h5 className="font-semibold text-sm mb-2">Cabinet Build Details</h5>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                              <div>
                                                <span className="text-gray-500">Build ID:</span>
                                                <p className="font-medium">{cabinetBuildDetails[item.itemName].cabbuildid || ''}</p>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Product Line:</span>
                                                <p className="font-medium">{cabinetBuildDetails[item.itemName].prodline || ''}</p>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Material:</span>
                                                <p className="font-medium">{cabinetBuildDetails[item.itemName].material || ''}</p>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Upper Door Style:</span>
                                                <p className="font-medium">{cabinetBuildDetails[item.itemName].upperdoorstyle || ''}</p>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Lower Door Style:</span>
                                                <p className="font-medium">{cabinetBuildDetails[item.itemName].lowerdoorstyle || ''}</p>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Cabinet Construction:</span>
                                                <p className="font-medium">{cabinetBuildDetails[item.itemName].cabinetconstruction || ''}</p>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Cabinet Style:</span>
                                                <p className="font-medium">{cabinetBuildDetails[item.itemName].cabinetstyle || ''}</p>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Hinge Type:</span>
                                                <p className="font-medium">{cabinetBuildDetails[item.itemName].hingetype || ''}</p>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Drawer Construction:</span>
                                                <p className="font-medium">{cabinetBuildDetails[item.itemName].drawerconstruction || ''}</p>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Drawer Style:</span>
                                                <p className="font-medium">{cabinetBuildDetails[item.itemName].drawerstyle || ''}</p>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Exterior Finish:</span>
                                                <p className="font-medium">{cabinetBuildDetails[item.itemName].exteriorfinish || ''}</p>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Treatment:</span>
                                                <p className="font-medium">{cabinetBuildDetails[item.itemName].treatment || ''}</p>
                                              </div>
                                              {cabinetBuildDetails[item.itemName].memo && (
                                                <div className="col-span-2">
                                                  <span className="text-gray-500">Memo:</span>
                                                  <p className="font-medium">{cabinetBuildDetails[item.itemName].memo}</p>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {itemNameLower.includes('spcntr') && (
                                      <div className="mt-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            if (visibleBuildDetails[item.itemName]) {
                                              setVisibleBuildDetails(prev => ({ ...prev, [item.itemName]: false }));
                                            } else {
                                              if (cabinetBuildDetails[item.itemName]) {
                                                setVisibleBuildDetails(prev => ({ ...prev, [item.itemName]: true }));
                                              } else {
                                                const buildIdOrOrderNum = item.cntrBuildId || order.orderNumber;
                                                fetchCounterBuildDetails(buildIdOrOrderNum, item.itemName);
                                                setVisibleBuildDetails(prev => ({ ...prev, [item.itemName]: true }));
                                              }
                                            }
                                          }}
                                          disabled={loadingCabinetBuild === item.itemName}
                                        >
                                          {loadingCabinetBuild === item.itemName ? 'Loading...' :
                                            visibleBuildDetails[item.itemName] ? 'Hide Details' : 'View Details'}
                                        </Button>

                                        {visibleBuildDetails[item.itemName] && cabinetBuildDetails[item.itemName] && (
                                          <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg">
                                            <h5 className="font-semibold text-sm mb-2">Counter Build Details</h5>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                              <div>
                                                <span className="text-gray-500">Build ID:</span>
                                                <p className="font-medium">{cabinetBuildDetails[item.itemName].cntrBuildId || 'N/A'}</p>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Material:</span>
                                                <p className="font-medium">{cabinetBuildDetails[item.itemName].material || 'N/A'}</p>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Edge:</span>
                                                <p className="font-medium">{cabinetBuildDetails[item.itemName].edge || 'N/A'}</p>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Backsplash:</span>
                                                <p className="font-medium">{cabinetBuildDetails[item.itemName].backsplash || 'N/A'}</p>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Thickness:</span>
                                                <p className="font-medium">{cabinetBuildDetails[item.itemName].thickness || 'N/A'}</p>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
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

                          <div className="mt-4 pt-4 border-t-2 border-gray-300 space-y-2 bg-gray-50 p-4 rounded-lg">
                            <h4 className="font-semibold text-gray-900 mb-2">Summary</h4>

                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">SUBTOTAL</span>
                              <span className="font-medium">${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>

                            {discountTotal > 0 && (
                              <div>
                                <div
                                  className={`flex justify-between text-sm rounded px-1 -mx-1 py-0.5 ${discountLineItems.length > 0 ? 'cursor-pointer select-none hover:bg-gray-100' : ''}`}
                                  onClick={() => discountLineItems.length > 0 && setDiscountsExpanded(!discountsExpanded)}
                                >
                                  <span className="text-gray-600 flex items-center gap-1">
                                    DISCOUNTS
                                    {discountLineItems.length > 0 && (
                                      discountsExpanded
                                        ? <ChevronUp className="h-3.5 w-3.5" />
                                        : <ChevronDown className="h-3.5 w-3.5" />
                                    )}
                                  </span>
                                  <span className="font-medium">-${discountTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                {discountsExpanded && discountLineItems.length > 0 && (
                                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-3">
                                    {discountLineItems.filter(d => d.amount > 0).map((d, i) => (
                                      <div key={`discount-${i}`} className="flex justify-between text-xs text-gray-500">
                                        <span className="truncate mr-2">{d.name}</span>
                                        <span className="whitespace-nowrap">-${d.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {order.tax && parseFloat(order.tax) > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">TAX</span>
                                <span className="font-medium">${parseFloat(order.tax).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                              <span>${parseFloat(order.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}

            {order.shippingAddress && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center">
                    <MapPin className="h-5 w-5 mr-2" />
                    Shipping Address
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-base">
                      {typeof order.shippingAddress === 'object'
                        ? Object.entries(order.shippingAddress)
                          .filter(([key, value]) => value)
                          .map(([key, value]) => (
                            <span key={key} className="block">
                              {key === 'addressee' ? <strong>{String(value)}</strong> : String(value)}
                            </span>
                          ))
                        : String(order.shippingAddress)
                      }
                    </p>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
